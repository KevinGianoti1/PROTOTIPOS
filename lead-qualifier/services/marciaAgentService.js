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
            // Recupera ou cria contato no DB
            let contact = await databaseService.getContact(phoneNumber);
            if (!contact) {
                contact = await databaseService.createContact(phoneNumber, { ready: false });
            }
            // Salva mensagem do usuário
            await databaseService.addMessage(phoneNumber, 'user', message);
            // Histórico para o prompt
            const history = await databaseService.getHistory(phoneNumber);

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
            const leadData = {
                lead: {
                    nome: data.name || 'Não informado',
                    telefone: data.phone || phoneNumber,
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

<tarefas>

1. **Apresentação:**  
Cumprimente de acordo com o horário (🌞, ☀️, 🌙), se apresente e comece o papo de forma leve e próxima.  

2. **CNPJ:**  
Peça o CNPJ da empresa de forma simples.  
Aceite com ou sem pontuação (14 dígitos).  

3. **Nome:**  
Peça o nome do responsável ou da empresa.  

4. **Telefone:**  
Peça o número de telefone ou WhatsApp com DDD.  

5. **E-mail:**  
Peça o e-mail para contato.  

6. **Origem:**  
Pergunte como conheceu a Maxi Force (Instagram, Google, Indicação, Site, etc.).  

7. **Interesse:**  
Pergunte quais produtos tem interesse (discos, serras, lixas, etc.) e para qual aplicação (granito, porcelanato, etc.).  

8. **Prazo:**  
Pergunte para quando precisa do material.  

</tarefas>

<regras>
- Se o cliente não souber o CNPJ, peça o nome da empresa e cidade para tentar localizar.  
- Se o cliente for consumidor final (CPF), explique educadamente que atendemos apenas empresas e indique um revendedor próximo (invente um nome de loja genérico se necessário ou diga que vai verificar).  
- Se o cliente perguntar preço, diga que o consultor comercial fará a cotação personalizada.
- **Envio de Catálogo:** Se o cliente pedir o catálogo, PDF ou portfólio, responda que vai enviar e adicione a tag [SEND_CATALOG] no final da sua resposta.
</regras>

<saida>
Sempre termine sua resposta com uma pergunta para manter a conversa fluindo, a menos que tenha finalizado a coleta.
Quando tiver coletado CNPJ, Nome e Telefone, tente extrair os dados em formato JSON no final da mensagem (oculto para o usuário, mas visível para o sistema).
Se for enviar o catálogo, inclua [SEND_CATALOG].
</saida>`;
    }
}

module.exports = new MarciaAgentService();
