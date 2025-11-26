require('dotenv').config();
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const cnpjService = require('./cnpjService');
const validationService = require('./validationService');
const rdStationService = require('./rdStationService');
const databaseService = require('./databaseService');
const knowledgeBaseService = require('./knowledgeBaseService');
const leadScoringService = require('./leadScoringService');
const { formatPhoneNumber, validateCNPJ, validateEmail } = require('../utils/validationHelpers');
const auditLogger = require('../utils/auditLogger');
const { containsProfanity, containsSensitiveData } = require('../utils/contentFilter');

/**
 * Serviço do Agente Márcia
 * Gerencia conversas com leads usando OpenAI
 */
class MarciaAgentService {
    constructor() {
        this.openai = null;
        // Inicializa Banco de Dados
        databaseService.init().catch(err => logger.error('Erro fatal ao iniciar DB:', err));
        // Inicializa OpenAI se a chave estiver configurada
        if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') {
            this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            logger.info('✅ OpenAI configurada');
        } else {
            logger.warn('⚠️ OPENAI_API_KEY não configurada - Márcia não poderá responder');
        }
    }

    /**
     * Processa mensagem do lead
     * @param {string} phoneNumber - Número do telefone
     * @param {string} message - Mensagem recebida
     * @returns {Promise<string>} - Resposta da Márcia
     */
    async processMessage(phoneNumber, message) {
        if (!this.openai) {
            return 'Oi! No momento estou com problemas técnicos 😅 Tente novamente mais tarde!';
        }
        try {
            // Log da mensagem recebida
            auditLogger.logMessage(phoneNumber, 'user', message);

            // Verifica palavrões
            if (containsProfanity(message)) {
                auditLogger.log({ type: 'profanity_detected', phoneNumber, message: message.substring(0, 100) });
                await databaseService.updateContact(phoneNumber, { flagged_for_moderation: true });
                return 'Entendo sua frustração! Vou transferir você para um atendente humano. 🙏';
            }

            // Verifica dados sensíveis
            const sensitiveCheck = containsSensitiveData(message);
            if (sensitiveCheck.hasSensitiveData) {
                auditLogger.log({ type: 'sensitive_data_detected', phoneNumber, dataType: sensitiveCheck.type });
                return '⚠️ ATENÇÃO! Nunca compartilhe senhas ou dados de cartão. Por segurança, vou ignorar essa mensagem.';
            }

            // Recupera ou cria contato no DB
            let contact = await databaseService.getContact(phoneNumber);
            if (!contact) {
                contact = await databaseService.createContact(phoneNumber, { ready: false });
            }

            // Verifica timeout de conversa (24 horas)
            if (contact.ultima_interacao) {
                const lastInteraction = new Date(contact.ultima_interacao);
                const hoursSinceLastMessage = (new Date() - lastInteraction) / (1000 * 60 * 60);

                if (hoursSinceLastMessage > 24) {
                    auditLogger.log({ type: 'conversation_timeout', phoneNumber, hoursSinceLastMessage });
                    // Reseta conversa
                    await databaseService.updateContact(phoneNumber, {
                        data_cache: {},
                        stage: 'new',
                        cnpj_attempts: 0,
                        cnpj_confirmed: false
                    });
                    contact = await databaseService.getContact(phoneNumber);
                    return 'Oi! Faz um tempo que não conversamos. Vamos começar de novo? 😊';
                }
            }

            // Verifica se está bloqueado
            if (contact.blocked_until) {
                const blockedUntil = new Date(contact.blocked_until);
                if (new Date() < blockedUntil) {
                    const minutesLeft = Math.ceil((blockedUntil - new Date()) / (1000 * 60));
                    return `Você atingiu o limite de tentativas. Por favor, aguarde ${minutesLeft} minutos ou entre em contato pelo telefone (11) 1234-5678.`;
                } else {
                    // Desbloqueia
                    await databaseService.updateContact(phoneNumber, {
                        blocked_until: null,
                        cnpj_attempts: 0
                    });
                }
            }

            // Salva mensagem do usuário
            await databaseService.addMessage(phoneNumber, 'user', message);
            // Histórico para o prompt
            const history = await databaseService.getHistory(phoneNumber);

            logger.info(`📜 Histórico recuperado para ${phoneNumber}: ${history.length} mensagens`);
            if (history.length > 0) {
                logger.info('   Última mensagem do histórico:', history[history.length - 1]);
            }

            // Contexto do RAG
            const context = knowledgeBaseService.getContext(message);

            // Chama OpenAI
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'system', content: this.getSystemPrompt(context) }, ...history],
                temperature: 0.7,
                max_tokens: 1200
            });
            const assistantMessage = completion.choices[0].message.content;
            // Salva resposta
            await databaseService.addMessage(phoneNumber, 'assistant', assistantMessage);

            // Extrai dados da resposta da IA
            const extractedData = this.extractDataFromResponse(assistantMessage);
            // Também extrai dados da mensagem do usuário
            const userExtractedData = this.extractDataFromResponse(message);
            // Combina os dados
            const combinedData = { ...userExtractedData, ...extractedData };

            // Valida CNPJ se foi extraído
            if (combinedData.cnpj) {
                const isValidCNPJ = validateCNPJ(combinedData.cnpj);
                auditLogger.logValidation(phoneNumber, 'cnpj', combinedData.cnpj, isValidCNPJ);

                if (!isValidCNPJ) {
                    // Incrementa tentativas
                    const attempts = (contact.cnpj_attempts || 0) + 1;
                    await databaseService.updateContact(phoneNumber, { cnpj_attempts: attempts });

                    if (attempts >= 3) {
                        // Bloqueia por 1 hora
                        const blockedUntil = new Date(Date.now() + 60 * 60 * 1000);
                        await databaseService.updateContact(phoneNumber, { blocked_until: blockedUntil.toISOString() });
                        auditLogger.logBlock(phoneNumber, 'cnpj_attempts_exceeded', '1 hour');
                        return 'Você tentou muitos CNPJs inválidos. Por favor, aguarde 1 hora ou entre em contato pelo telefone (11) 1234-5678.';
                    }

                    return `Esse CNPJ parece estar incorreto. Pode verificar e me enviar novamente? 😊\n(Tentativa ${attempts} de 3)`;
                }

                // CNPJ válido - reseta tentativas
                await databaseService.updateContact(phoneNumber, { cnpj_attempts: 0 });
            }

            // Valida e-mail se foi extraído
            if (combinedData.email) {
                const isValidEmail = validateEmail(combinedData.email);
                auditLogger.logValidation(phoneNumber, 'email', combinedData.email, isValidEmail);

                if (!isValidEmail) {
                    return 'Esse e-mail parece estar incorreto. Pode verificar? 📧';
                }
            }

            // Log dos dados extraídos
            auditLogger.logMessage(phoneNumber, 'assistant', assistantMessage, combinedData);

            // Atualiza contato
            const currentData = contact.data_cache || {};
            const updatedData = { ...currentData, ...combinedData };

            // Prepara campos para atualização
            const updateFields = {
                data_cache: updatedData,
                ultima_interacao: new Date().toISOString()
            };

            // Atualiza campos individuais se presentes
            if (combinedData.cnpj) {
                updateFields.cnpj = combinedData.cnpj.replace(/\D/g, ''); // Remove formatação
            }
            if (combinedData.name) updateFields.name = combinedData.name;
            if (combinedData.email) updateFields.email = combinedData.email;
            if (combinedData.origin) updateFields.origin = combinedData.origin;
            if (combinedData.campaign) updateFields.campaign = combinedData.campaign;
            if (combinedData.source) updateFields.source = combinedData.source;
            if (combinedData.product) updateFields.produto_interesse = combinedData.product;
            if (combinedData.quantity) updateFields.quantidade_estimada = combinedData.quantity;
            if (combinedData.prazo) updateFields.prazo_compra = combinedData.prazo;

            await databaseService.updateContact(phoneNumber, updateFields);

            // Calcula lead score após atualização
            try {
                await leadScoringService.scoreContact(phoneNumber);
            } catch (scoreError) {
                logger.warn('Erro ao calcular score:', scoreError);
            }

            // Recarrega contato atualizado
            const updatedContact = await databaseService.getContact(phoneNumber);

            // Processa lead se: (1) marcado como ready OU (2) usuário confirmou E tem dados mínimos
            const hasMinimalData = updatedContact.cnpj && updatedContact.name;
            const shouldProcess = combinedData.ready || (combinedData.confirmed && hasMinimalData);

            if (shouldProcess) {
                logger.info('✅ Coleta completa para', phoneNumber, '- Processando lead...');
                await this.processCompleteLead(phoneNumber, updatedData);
            }
            return assistantMessage;
        } catch (error) {
            logger.error('Erro ao processar mensagem:', error);
            return 'Ops! Tive um probleminha aqui 😅 Pode repetir?';
        }
    }

    /**
     * Transcreve áudio usando Whisper
     * @param {string} filePath - Caminho do arquivo de áudio
     * @returns {Promise<string>} - Texto transcrito
     */
    async transcribeAudio(filePath) {
        try {
            logger.info('🎙️ Transcrevendo áudio...', { file: filePath });
            const transcription = await this.openai.audio.transcriptions.create({
                file: fs.createReadStream(filePath),
                model: "whisper-1",
                language: "pt"
            });
            logger.info('🗣️ Transcrição:', transcription.text);
            return transcription.text;
        } catch (error) {
            logger.error('❌ Erro na transcrição:', error);
            throw new Error('Não consegui ouvir seu áudio 😔');
        }
    }

    /**
     * Processa lead completo (valida e envia para RD Station)
     */
    async processCompleteLead(phoneNumber, data) {
        try {
            // Verifica se já foi processado para evitar duplicidade
            const contact = await databaseService.getContact(phoneNumber);
            if (contact && contact.stage === 'completed') {
                logger.info('⚠️ Lead já processado anteriormente, ignorando duplicidade:', phoneNumber);
                return;
            }

            logger.info('🔄 Processando lead completo:', data);
            // 1. Consulta CNPJ
            const empresaData = await cnpjService.consultarCNPJ(data.cnpj);
            // 2. Valida CNAE
            const isValid = validationService.validateCNAE(empresaData.cnaePrincipal.codigo, empresaData.cnaesSecundarios);
            if (!isValid) {
                logger.info('❌ CNAE não aprovado para', phoneNumber);
                await databaseService.updateContact(phoneNumber, { stage: 'disqualified' });
                return;
            }
            // 3. Resumo da conversa
            const history = await databaseService.getHistory(phoneNumber);
            let conversationSummary = '';
            if (history) {
                conversationSummary = history
                    .map(msg => `${msg.role === 'user' ? '👤 Cliente' : '🤖 Márcia'}: ${msg.content}`)
                    .join('\n\n');
            }
            // 4. Dados para RD Station
            const formattedPhone = formatPhoneNumber(data.phone || phoneNumber);

            const leadData = {
                lead: {
                    nome: data.name || 'Não informado',
                    telefone: formattedPhone,
                    email: data.email || '',
                    origem: data.origin || 'WhatsApp'
                },
                empresa: {
                    ...empresaData,
                    razaoSocial: empresaData.razaoSocial,
                    nomeFantasia: empresaData.nomeFantasia,
                    cnpjFormatado: empresaData.cnpjFormatado,
                    logradouro: empresaData.endereco.logradouro,
                    numero: empresaData.endereco.numero,
                    bairro: empresaData.endereco.bairro,
                    municipio: empresaData.endereco.municipio,
                    uf: empresaData.endereco.uf,
                    cep: empresaData.endereco.cep,
                    email: empresaData.email,
                    ddd: empresaData.telefone.match(/\((\d{2})\)/)?.[1] || '',
                    telefone: empresaData.telefone.replace(/\D/g, '')
                },
                validacao: {
                    qualificado: true,
                    motivo: 'CNAE aprovado pela Márcia',
                    cnaeMatch: empresaData.cnaePrincipal
                },
                conversationSummary
            };
            // 5. Cria no RD Station
            const result = await rdStationService.processLead(leadData);
            logger.info('✅ Lead processado com sucesso:', result);
            // Marca como completado
            await databaseService.updateContact(phoneNumber, { stage: 'completed' });
        } catch (error) {
            logger.error('❌ Erro ao processar lead completo:', error);
        }
    }

    /**
     * Extrai dados estruturados da resposta da IA
     */
    extractDataFromResponse(response) {
        const data = {};
        // Tenta encontrar JSON
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                // Remove asteriscos dos valores
                Object.keys(parsed).forEach(key => {
                    if (typeof parsed[key] === 'string') {
                        parsed[key] = parsed[key].replace(/\*\*/g, '').trim();
                    }
                });
                return parsed;
            } catch (e) {
                // continua com regex
            }
        }

        // Padrões melhorados para capturar dados com ou sem asteriscos
        const patterns = {
            cnpj: /(?:CNPJ|cnpj)[:\s*]+\*?\*?([0-9.\/\-]{14,18})\*?\*?/i,
            name: /(?:Nome|empresa)[:\s*]+\*?\*?([^\n*]+?)\*?\*?(?:\n|$)/i,
            phone: /(?:Telefone|WhatsApp)[:\s*]+\*?\*?([0-9\s\-\(\)]+?)\*?\*?(?:\n|$)/i,
            email: /(?:E[-]?mail)[:\s*]+\*?\*?([^\s\n*]+@[^\s\n*]+?)\*?\*?(?:\n|$)/i,
            origin: /(?:Origem)[:\s*]+\*?\*?([^\n*]+?)\*?\*?(?:\n|$)/i,
            source: /(?:Fonte)[:\s*]+\*?\*?([^\n*]+?)\*?\*?(?:\n|$)/i,
            campaign: /(?:Campanha)[:\s*]+\*?\*?([^\n*]+?)\*?\*?(?:\n|$)/i,
            product: /(?:Interesse|Produto)[:\s*]+\*?\*?([^\n*]+?)\*?\*?(?:\n|$)/i,
            quantity: /(?:Quantidade)[:\s*]+\*?\*?([0-9]+)/i,
            prazo: /(?:Prazo)[:\s*]+\*?\*?([^\n*]+?)\*?\*?(?:\n|$)/i
        };

        for (const [key, regex] of Object.entries(patterns)) {
            const match = response.match(regex);
            if (match) {
                let value = match[1].trim();
                // Remove asteriscos e prefixos
                value = value.replace(/\*\*/g, '').replace(/^(do\s+contato:\s*|de\s+compra:\s*)/i, '').trim();
                data[key] = value;
            }
        }

        // Detecta confirmação do usuário
        if (/\b(está|tudo|sim|correto|certo|ok|confirmo|confirmar)\b/i.test(response)) {
            data.confirmed = true;
        }

        if (data.cnpj && data.name && data.phone) {
            data.ready = true;
        }
        return data;
    }

    /**
     * Retorna o prompt do sistema (baseado no N8N)
     */
    /**
     * Retorna o prompt do sistema (baseado no N8N)
     * @param {string} context - Contexto do RAG (catálogo)
     */
    getSystemPrompt(context = '') {
        return `<contexto>
Você é "Márcia 😄", SDR da Maxi Force Ferramentas Diamantadas.  
Seu papel é conversar com leads de forma leve, simpática e inteligente, coletar as informações necessárias e encaminhar ao time de vendas.  
Você entende o básico sobre discos, serras, lixas e brocas diamantadas e suas aplicações em porcelanato, granito, quartzo, madeira e inox.  

📚 **Base de Conhecimento (Catálogo):**
Use as informações abaixo para responder dúvidas técnicas sobre produtos. Se a informação não estiver aqui, diga que vai confirmar com o técnico.
${context}

🎯 **Estilo de comunicação:**  
- Fale em português com naturalidade e empolgação, como uma pessoa real.  
- Use frases curtas, diretas e com emojis pontuais (✨, 😄, 🔹, 🙌, 😉, 🚀).  
- Evite linguagem formal ou corporativa.  
- Use as informações que o cliente fornecer para contextualizar a conversa e avançar de forma lógica.  
- Nunca repita perguntas já respondidas — use os dados disponíveis para confirmar e seguir.  
- Nunca peça desculpas; mantenha leveza e siga adiante.  

📋 A Maxi Force atende apenas empresas (distribuidores, revendedores e lojistas).  
Não trabalha com consumidores finais.  
Você não fala sobre preços, descontos, condições comerciais.  

</contexto>

<instrucoes_inteligencia>
- **UMA COISA DE CADA VEZ:** Nunca peça várias informações na mesma mensagem. Pergunte uma coisa, espere a resposta, e depois pergunte a próxima.
- **Analise o Histórico:** Antes de perguntar qualquer coisa, verifique se o cliente já forneceu a informação nas mensagens anteriores.
- **Não seja repetitiva:** Se o cliente disse "Vi no Instagram", NÃO pergunte "Como conheceu?". Apenas confirme: "Ah, legal que viu no Instagram!".
- **Fluxo Natural:** Não siga a ordem abaixo como um robô. Colete as informações conforme o fluxo da conversa.
</instrucoes_inteligencia>

<informacoes_necessarias>
Você precisa coletar os seguintes dados (se já tiver, pule):

1. **CNPJ:** (Essencial)
2. **Nome do Responsável/Empresa:** (Se não estiver claro no CNPJ)
3. **Telefone/WhatsApp:** (Geralmente você já tem o número que ele está chamando, só confirme se é esse mesmo para contato)
4. **E-mail:** (Para envio de propostas)
5. **Origem:** (Onde conheceu a Maxi Force)
6. **Interesse/Aplicação:** (Qual produto e para que serve - ex: Serra para granito)
7. **Prazo:** (Para quando precisa)
</informacoes_necessarias>

<regras>
- Se o cliente não souber o CNPJ, peça o nome da empresa e cidade para tentar localizar.  
- Se o cliente for consumidor final (CPF), explique educadamente que atendemos apenas empresas e indique um revendedor próximo (invente um nome de loja genérico se necessário ou diga que vai verificar).  
- Se o cliente perguntar preço, diga que o consultor comercial fará a cotação personalizada.
- **Envio de Catálogo:** SEMPRE que o cliente pedir "catálogo", "PDF", "portfólio" ou "lista de produtos", você DEVE dizer que vai enviar e OBRIGATORIAMENTE adicionar a tag [SEND_CATALOG] no final da resposta.
</regras>

<saida>
Sempre termine sua resposta com uma pergunta para manter a conversa fluindo, a menos que tenha finalizado a coleta.

**IMPORTANTE:** Quando apresentar um resumo dos dados coletados para confirmação do cliente, formate EXATAMENTE assim:

- *CNPJ:* 08054886000168
- *Nome da empresa:* ABRAMAX
- *Telefone:* 11987650924
- *Interesse:* Discos e lixas para granito
- *Prazo:* O mais rápido possível
- *Origem:* Instagram

Após a confirmação do cliente, adicione no final da sua resposta (invisível para o usuário):
{"ready": true, "cnpj": "08054886000168", "name": "ABRAMAX", "phone": "11987650924", "product": "Discos e lixas para granito", "prazo": "O mais rápido possível", "origin": "Instagram"}

Se for enviar o catálogo, inclua [SEND_CATALOG].
</saida>`;
    }
}

module.exports = new MarciaAgentService();
