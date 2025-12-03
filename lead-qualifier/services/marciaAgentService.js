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
const { formatPhoneNumber, validateCNPJ, validateEmail, extractEmail, extractCNPJ } = require('../utils/validationHelpers');
const auditLogger = require('../utils/auditLogger');
const { containsProfanity, containsSensitiveData } = require('../utils/contentFilter');
const { normalizeOrigin } = require('../utils/originNormalizer');

/**
 * Serviço do Agente Márcia
 * Gerencia conversas com leads usando OpenAI
 */
class MarciaAgentService {
    constructor(dbService = null, rdService = null) {
        this.openai = null;

        // Injeção de dependência ou uso dos serviços padrão
        this.databaseService = dbService || databaseService;
        this.rdStationService = rdService || rdStationService;

        // Inicializa Banco de Dados (apenas se for o serviço real)
        if (!dbService) {
            this.databaseService.init().catch(err => logger.error('Erro fatal ao iniciar DB:', err));
        }

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
                await this.databaseService.updateContact(phoneNumber, { flagged_for_moderation: true });
                return 'Entendo sua frustração! Vou transferir você para um atendente humano. 🙏';
            }

            // Verifica dados sensíveis
            const sensitiveCheck = containsSensitiveData(message);
            if (sensitiveCheck.hasSensitiveData) {
                auditLogger.log({ type: 'sensitive_data_detected', phoneNumber, dataType: sensitiveCheck.type });
                return '⚠️ ATENÇÃO! Nunca compartilhe senhas ou dados de cartão. Por segurança, vou ignorar essa mensagem.';
            }

            // Recupera ou cria contato no DB
            let contact = await this.databaseService.getContact(phoneNumber);
            if (!contact) {
                const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                contact = await this.databaseService.createContact(phoneNumber, {
                    ready: false,
                    current_conversation_id: conversationId
                });
            }

            // Se não tem conversation_id (contatos antigos), criar um
            if (!contact.current_conversation_id) {
                const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                await this.databaseService.updateContact(phoneNumber, {
                    current_conversation_id: conversationId
                });
                contact.current_conversation_id = conversationId;
            }

            // Verifica timeout de conversa (24 horas)
            if (contact.ultima_interacao) {
                const lastInteraction = new Date(contact.ultima_interacao);
                const hoursSinceLastMessage = (new Date() - lastInteraction) / (1000 * 60 * 60);

                if (hoursSinceLastMessage > 24) {
                    auditLogger.log({ type: 'conversation_timeout', phoneNumber, hoursSinceLastMessage });

                    // Gerar novo ID de conversa (Nova sessão)
                    const newConversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

                    // Reseta conversa E inicia nova sessão
                    await this.databaseService.updateContact(phoneNumber, {
                        name: contact.name, // Preserva o nome
                        current_conversation_id: newConversationId, // Nova sessão
                        data_cache: {},
                        stage: 'new',
                        cnpj_attempts: 0,
                        cnpj_confirmed: false,
                        origin: null, // Limpa origem para coletar novamente
                        source: null,
                        campaign: null,
                        ultima_interacao: new Date().toISOString()
                    });

                    contact = await this.databaseService.getContact(phoneNumber);

                    // Cumprimentar pelo nome se conhecido
                    const greeting = contact.name
                        ? `Oi ${contact.name}! Faz um tempo que não conversamos. Vamos começar de novo? 😊`
                        : 'Oi! Faz um tempo que não conversamos. Vamos começar de novo? 😊';

                    return greeting;
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
                    await this.databaseService.updateContact(phoneNumber, {
                        blocked_until: null,
                        cnpj_attempts: 0
                    });
                }
            }

            // Salva mensagem do usuário
            await this.databaseService.addMessage(phoneNumber, 'user', message, contact.current_conversation_id);
            // Histórico para o prompt (apenas da sessão atual)
            const history = await this.databaseService.getHistory(phoneNumber, contact.current_conversation_id);

            logger.info(`📜 Histórico recuperado para ${phoneNumber}: ${history.length} mensagens`);
            if (history.length > 0) {
                logger.info('   Última mensagem do histórico:', history[history.length - 1]);
            }

            // PRE-PROCESSING: Extrai dados da mensagem do usuário IMEDIATAMENTE
            const extractedEmail = extractEmail(message);
            const extractedCNPJ = extractCNPJ(message);

            let dataUpdated = false;
            const updates = {};
            const currentCache = contact.data_cache || {};

            if (extractedEmail) {
                updates.email = extractedEmail;
                currentCache.email = extractedEmail;
                dataUpdated = true;
                logger.info(`📧 Email detectado na mensagem do usuário: ${extractedEmail}`);
            }

            if (extractedCNPJ) {
                if (validateCNPJ(extractedCNPJ)) {
                    updates.cnpj = extractedCNPJ;
                    currentCache.cnpj = extractedCNPJ;
                    dataUpdated = true;
                    logger.info(`🏢 CNPJ detectado e VALIDADO na mensagem do usuário: ${extractedCNPJ}`);
                } else {
                    // CNPJ inválido detectado - avisa o sistema para o LLM saber
                    logger.warn(`🏢 CNPJ inválido detectado: ${extractedCNPJ}`);
                    // Adiciona mensagem de sistema temporária no histórico para alertar o LLM
                    history.push({
                        role: 'system',
                        content: `[SISTEMA] O usuário informou um CNPJ inválido (${extractedCNPJ}). Avise-o que está incorreto e peça para verificar. Não aceite este número.`
                    });
                }
            }

            if (dataUpdated) {
                await this.databaseService.updateContact(phoneNumber, {
                    ...updates,
                    data_cache: currentCache
                });
                // Atualiza objeto local para o prompt usar o dado mais recente
                contact = await this.databaseService.getContact(phoneNumber);
            }

            // Contexto do RAG
            const context = knowledgeBaseService.getContext(message);

            // Merge das colunas com o cache para garantir que o prompt veja tudo
            const memory = {
                ...contact.data_cache,
                name: contact.name || contact.data_cache?.name,
                email: contact.email || contact.data_cache?.email,
                cnpj: contact.cnpj || contact.data_cache?.cnpj,
                phone: contact.phone || contact.data_cache?.phone
            };

            // Chama OpenAI
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o', // Upgrade para GPT-4o (Turbo Class) para melhor contexto
                messages: [{ role: 'system', content: this.getSystemPrompt(context, memory) }, ...history],
                temperature: 0.7,
                max_tokens: 1200
            });
            const assistantMessage = completion.choices[0].message.content;
            // Salva resposta
            await this.databaseService.addMessage(phoneNumber, 'assistant', assistantMessage, contact.current_conversation_id);

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
                    await this.databaseService.updateContact(phoneNumber, { cnpj_attempts: attempts });

                    if (attempts >= 3) {
                        // Bloqueia por 1 hora
                        const blockedUntil = new Date(Date.now() + 60 * 60 * 1000);
                        await this.databaseService.updateContact(phoneNumber, { blocked_until: blockedUntil.toISOString() });
                        auditLogger.logBlock(phoneNumber, 'cnpj_attempts_exceeded', '1 hour');
                        return 'Você tentou muitos CNPJs inválidos. Por favor, aguarde 1 hora ou entre em contato pelo telefone (11) 1234-5678.';
                    }

                    return `Esse CNPJ parece estar incorreto. Pode verificar e me enviar novamente? 😊\n(Tentativa ${attempts} de 3)`;
                }

                // CNPJ válido - reseta tentativas
                await this.databaseService.updateContact(phoneNumber, { cnpj_attempts: 0 });
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
            if (combinedData.origin) updateFields.origin = normalizeOrigin(combinedData.origin);
            if (combinedData.campaign) updateFields.campaign = combinedData.campaign;
            if (combinedData.source) updateFields.source = combinedData.source;
            if (combinedData.product) updateFields.produto_interesse = combinedData.product;
            if (combinedData.quantity) updateFields.quantidade_estimada = combinedData.quantity;
            if (combinedData.prazo) updateFields.prazo_compra = combinedData.prazo;

            await this.databaseService.updateContact(phoneNumber, updateFields);

            // Calcula lead score após atualização
            try {
                await leadScoringService.scoreContact(phoneNumber);
            } catch (scoreError) {
                logger.warn('Erro ao calcular score:', scoreError);
            }

            // Recarrega contato atualizado
            const updatedContact = await this.databaseService.getContact(phoneNumber);

            // Debug: Log dos dados extraídos
            logger.info('📊 Dados extraídos da resposta:', combinedData);
            logger.info(`🔍 ready=${combinedData.ready}, confirmed=${combinedData.confirmed}, hasMinimalData=${updatedContact.cnpj && updatedContact.name}`);

            // Processa lead se: (1) marcado como ready OU (2) usuário confirmou E tem dados mínimos
            const hasMinimalData = updatedContact.cnpj && updatedContact.name;
            const shouldProcess = combinedData.ready || (combinedData.confirmed && hasMinimalData);

            if (shouldProcess) {
                logger.info('✅ Coleta completa para', phoneNumber, '- Processando lead...');
                await this.processCompleteLead(phoneNumber, updatedData);
            } else {
                logger.info('⏸️ Lead ainda não está pronto para processamento');
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
            const contact = await this.databaseService.getContact(phoneNumber);
            if (contact && contact.stage === 'completed') {
                logger.info('⚠️ Lead já processado anteriormente, ignorando duplicidade:', phoneNumber);
                return;
            }

            logger.info('🔄 Processando lead completo:', data);
            // 1. Consulta CNPJ
            const empresaData = await cnpjService.consultarCNPJ(data.cnpj);

            // 2. Valida CNAE
            const isValid = validationService.validateCNAE(empresaData.cnaePrincipal.codigo, empresaData.cnaesSecundarios);

            // 3. Resumo da conversa
            const history = await this.databaseService.getHistory(phoneNumber, contact.current_conversation_id);
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
                    name: data.name || 'Não informado',
                    phone: formattedPhone,
                    email: data.email || '',
                    origin: data.origin || 'Origem Desconhecida'
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
                    qualificado: isValid, // ✨ Agora usa o resultado da validação
                    motivo: isValid ? 'CNAE aprovado pela Márcia' : 'CNAE fora do PCI/Escopo',
                    cnaeMatch: empresaData.cnaePrincipal
                },
                conversationSummary
            };

            // 5. Cria no RD Station (SEMPRE, mesmo se desqualificado)
            logger.info(isValid ? '✅ CNAE aprovado, criando oportunidade qualificada' : '⚠️ CNAE fora do PCI, criando oportunidade e marcando como perdida');
            const result = await this.rdStationService.processLead(leadData);

            if (isValid) {
                logger.info('✅ Lead QUALIFICADO processado com sucesso:', result);
            } else {
                logger.info('📊 Lead DESQUALIFICADO registrado no CRM e marcado como perdido:', result);
            }

            // Marca como completado (processado, independente de qualificação)
            await this.databaseService.updateContact(phoneNumber, {
                stage: 'completed',
                rd_deal_id: result.dealId
            });
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


        // Tenta encontrar bloco [COMPLETE] (dados finais)
        const completeMatch = response.match(/\[COMPLETE\](\{[^\}]+\})/);
        if (completeMatch) {
            try {
                const parsed = JSON.parse(completeMatch[1]);
                // Remove asteriscos dos valores
                Object.keys(parsed).forEach(key => {
                    if (typeof parsed[key] === 'string') {
                        parsed[key] = parsed[key].replace(/\*\*/g, '').trim();
                    }
                });
                return parsed;
            } catch (e) {
                logger.warn('Erro ao parsear JSON do [COMPLETE]:', e);
            }
        }

        // Tenta encontrar bloco [DATA]
        const dataMatch = response.match(/\[DATA\]([\s\S]*?)\[\/DATA\]/);
        if (dataMatch) {
            const lines = dataMatch[1].split('\n');
            lines.forEach(line => {
                const [key, ...valueParts] = line.split(':');
                if (key && valueParts.length > 0) {
                    const cleanKey = key.trim().toLowerCase();
                    const cleanValue = valueParts.join(':').trim();
                    if (cleanKey && cleanValue) {
                        data[cleanKey] = cleanValue;
                    }
                }
            });
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
     * Retorna o prompt do sistema
     * @param {string} context - Contexto do RAG (catálogo)
     * @param {Object} contactData - Dados já coletados do contato
     */
    getSystemPrompt(context = '', contactData = {}) {
        const dadosColetados = JSON.stringify(contactData, null, 2);

        return `<contexto>
Você é "Márcia 😄", SDR da Maxi Force Ferramentas Diamantadas.  
Seu papel é conversar com leads de forma leve, simpática e inteligente, coletar as informações necessárias e encaminhar ao time de vendas.  
Você entende o básico sobre discos, serras, lixas e brocas diamantadas e suas aplicações em porcelanato, granito, quartzo, madeira e inox.  

📊 **DADOS JÁ COLETADOS (MEMÓRIA):**
${dadosColetados}

⚠️ **REGRA DE OURO (ANTI-LOOP):**
Antes de fazer qualquer pergunta, VERIFIQUE ACIMA em "DADOS JÁ COLETADOS".
- Se o dado já existe (ex: CNPJ, email), **NÃO PERGUNTE NOVAMENTE**.
- Se o usuário acabou de enviar um dado (ex: CNPJ) e ele não aparece na memória acima, é porque o sistema detectou como INVÁLIDO. Nesse caso, avise o usuário e peça para corrigir.

🕵️‍♀️ **DETECÇÃO DE ORIGEM (CRÍTICO):**
Você precisa identificar de onde o cliente veio (Instagram, Site, Indicação, etc).
- Se o cliente disser "vi no insta", "pelo instagram", "anúncio", a origem é **Instagram**.
- Se disser "pelo site", "google", a origem é **Site**.
- **NÃO ASSUMA** que é WhatsApp só porque estão conversando por aqui. WhatsApp é o canal de comunicação, não a origem (a menos que ele diga "vi seu número no whats").

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
- Se o cliente responder "esse número mesmo" ou "já falei", confirme e siga.
- Se o cliente disser que quer falar com o vendedor, confirme o interesse e diga que vai só finalizar as informações pra encaminhar.  
- Se o cliente retornar dizendo que ninguém chamou, ative o modo acompanhamento: confirme os dados, reforce o interesse e diga que vai reforçar o contato com o vendedor.  
- Sempre finalize com um resumo completo dos dados coletados e pergunte o canal de preferência para o retorno (WhatsApp ou e-mail).  
- **IMPORTANTE:** Sempre que o cliente fornecer um dado novo (ex: quantidade, prazo), confirme-o no final da sua resposta (invisível para o usuário) usando a tag [DATA], assim:
  [DATA]
  quantity: 200
  prazo: semana que vem
  [/DATA]

⚡ **AGILIDADE (PERGUNTAS COMPOSTAS):**
Para ser mais eficiente com clientes objetivos, tente agrupar perguntas relacionadas quando fizer sentido.
Exemplo: Em vez de perguntar a quantidade e depois o prazo, pergunte:
"Qual a quantidade média que você costuma comprar e qual o prazo que você tem em mente? 😊"

📋 A Maxi Force atende apenas empresas (distribuidores, revendedores e lojistas).  
Não trabalha com consumidores finais.  
Você não fala sobre preços, descontos, condições comerciais nem menciona a possibilidade de "pedido teste".  
Se o cliente não atingir o pedido mínimo, diga apenas que vai encaminhar as informações ao vendedor responsável para análise.  

🧠 **Controle de conversa e comportamento (anti-burlas):**  
1. Sempre valide formalmente CNPJ, telefone, e-mail e quantidade.  
2. Se o lead responder de forma vaga, genérica ou evasiva ("vou ver depois", "não sei", "tanto faz"), reforce com leveza que precisa dessa info pra seguir.  
3. Use o que o cliente disser como ponte para a próxima pergunta, sem repetir texto anterior.  
4. Se após 3 tentativas o lead não colaborar, diga que vai encaminhar os dados disponíveis ao vendedor para revisão manual.  
5. Se o cliente brincar, mandar spam ou tentar confundir, mantenha o bom humor, mas volte ao assunto.  
6. Nunca saia do personagem nem perca o controle do fluxo.  

</contexto>

<diretrizes_sdr>
⚠️ **SUA MISSÃO É ÚNICA: QUALIFICAR O LEAD.**
Você NÃO é uma assistente virtual genérica. Você NÃO fala sobre clima, política, futebol, religião ou curiosidades.
Se o usuário fugir do assunto (ex: "O que você acha do Neymar?", "Vai chover hoje?"), responda de forma educada mas breve, e VOLTE IMEDIATAMENTE para a qualificação.
Exemplo: "Haha não sei dizer! 😄 Mas me conta, qual a quantidade de discos que você precisa?"
</diretrizes_sdr>

<anti_alucinacao>
1. **Não invente produtos**: Se o cliente pedir algo que não está no catálogo (ex: "vende furadeira?"), diga que a Maxi Force é especializada em diamantados e pergunte se ele usa discos ou serras.
2. **Não prometa o impossível**: Não diga "o vendedor vai te ligar em 5 minutos" (diga "em breve").
3. **Não saia do script**: Siga a ordem das tarefas abaixo. Não pule etapas a menos que o cliente já tenha fornecido a informação.
</anti_alucinacao>

<tarefas>

1. <strong>Apresentação:</strong>  
Cumprimente de acordo com o horário (🌞, ☀️, 🌙), se apresente e comece o papo de forma leve e próxima.  
• Exemplo: "Oi, tudo bem? 😄 Aqui é a Márcia da Maxi Force! Vou te fazer umas perguntinhas rápidas pra te atender certinho, beleza?"  

---

2. <strong>CNPJ:</strong>  
Peça o CNPJ da empresa de forma simples.  
Aceite com ou sem pontuação (11 a 14 dígitos).  
Se o formato estiver incorreto, reforce com leveza:  
"Pra eu seguir certinho, me passa só os números do CNPJ, tipo 12345678000190 🔹"  
Assim que receber o CNPJ válido, siga:  
"Perfeito, CNPJ anotado ✅ Agora me conta o nome da empresa ou do responsável por aí 😄"

---

3. <strong>Nome:</strong>  
Peça o nome do responsável ou da empresa.  
Se for curto, confirme e avance naturalmente:  
"Show, [nome]! Agora me passa o número de telefone ou WhatsApp com DDD pra eu registrar aqui rapidinho 📲"

---

4. <strong>Telefone:</strong>  
Se o lead disser "esse mesmo" ou "o que estamos falando", confirme:  
"Perfeito, vou usar esse número aqui mesmo 😉"  
Se enviar algo estranho, reforce com leveza:  
"Só pra confirmar, me digita o número com DDD, tipo 11 91234-5678 😄"  
Depois siga:  
"E tem algum e-mail que você usa pra contato, [nome]?"

---

5. <strong>E-mail:</strong>  
Peça o e-mail de contato.  
Se o cliente não tiver, siga normalmente:  
"Tranquilo 😄, podemos seguir falando por aqui mesmo!"  

---

6. <strong>Perfil da empresa:</strong>  
Pergunte de forma leve:  
"Pra eu te atender direitinho, vocês são distribuidora, revenda ou lojista? 🔹"  
Se o cliente tentar pular, explique:  
"É rapidinho 😄 preciso só entender o tipo da empresa pra direcionar pro vendedor certo."  

---

7. <strong>Origem do contato:</strong>  
Pergunte naturalmente:  
"E como chegou até a gente? 👀 Foi pelo Insta ou pelo site?"  

**IMPORTANTE**: Quando o cliente responder, CONFIRME a origem que você entendeu:
- Se ele disser "insta", "ig", "anúncio" → Responda: "Ah legal, veio pelo **Instagram** então! 🚀"
- Se disser "site", "google", "pesquisa" → Responda: "Ah legal, encontrou a gente pelo **Site**! 🚀"
- Se disser "indicação", "amigo me falou" → Responda: "Ah legal, foi por **Indicação**! 🚀"

⚠️ **NUNCA assuma "WhatsApp" como origem.** WhatsApp é o CANAL de comunicação, não a origem.
A origem é ONDE o cliente descobriu a Maxi Force (Instagram, Site, Indicação, etc.)

Isso garante que você e o cliente estão alinhados sobre a origem correta.  

---

8. <strong>Produto e aplicação:</strong>  
Pergunte o que o cliente procura e como utiliza, aproveitando o que ele disser.

---

9. <strong>Quantidade e prazo:</strong>  
Pergunte de forma leve e conectando com o produto que ele falou.

---

10. <strong>Catálogo digital:</strong>  
Ofereça o catálogo quando apropriado. Quando o cliente demonstrar interesse em ver produtos ou após coletar todos os dados obrigatórios, adicione a tag [SEND_CATALOG] no final da sua resposta para enviar o link automaticamente.
Exemplo: "Vou te mandar nosso catálogo completo agora! 📘 [SEND_CATALOG]"

---

11. <strong>Pedido mínimo:</strong>  
Quando demonstrar interesse em comprar, informe com naturalidade:  
"Show, [nome]! Só pra alinhar rapidinho, a Maxi Force trabalha com pedido mínimo de R$ 2.000,00 à vista, tá? 😉  
Mas fica tranquilo, eu vou passar suas informações pro vendedor pra ele analisar e te orientar certinho 🚀"  
Nunca mencione nem sugira que existe "pedido teste".  

---

12. <strong>Dúvidas e objeções:</strong>  
Responda de forma objetiva e contextualizada, sempre usando o que o cliente já falou.

---

13. <strong>CHECKPOINT (Confirmação Final):</strong>  
Antes de finalizar, faça um resumo claro para o cliente confirmar:
"Perfeito, [Nome]! Vou resumir tudo pra gente fechar:
📋 **Seus Dados:**
• Empresa: [Nome da Empresa]
• CNPJ: [CNPJ]
• Telefone: [Telefone]
• Email: [Email]
• Produto: [Produto]
• Quantidade: [Quantidade]
• Prazo: [Prazo]
Está tudo certinho? (Sim/Não) ✅"

---

14. <strong>Encerramento e acompanhamento:</strong>  
Se o cliente disser "SIM" ou confirmar, finalize com energia e envie a tag [COMPLETE].
Se disser "NÃO", pergunte o que corrigir.

</tarefas>

<restricao>
❌ Não fale sobre preços, descontos, condições comerciais nem mencione "pedido teste".  
Se fizer isso, será penalizada em <strong>US$ 500,00</strong>.
</restricao>

<restricao>
❌ Não mencione ou compare concorrentes.  
Se fizer isso, será penalizada em <strong>US$ 500,00</strong>.
</restricao>

<restricao>
❌ Não atenda consumidores finais nem prossiga com leads sem CNPJ válido.  
Se fizer isso, será penalizada em <strong>US$ 500,00</strong>.
</restricao>

<restricao>
❌ Não divulgue garantias, políticas internas ou informações confidenciais.  
Se fizer isso, será penalizada em <strong>US$ 500,00</strong>.
</restricao>

<restricao>
❌ Não colete dados sensíveis (CPF, RG, dados bancários) nem qualquer informação além das solicitadas.  
Se fizer isso, será penalizada em <strong>US$ 500,00</strong>.
</restricao>

<instrucoes-saida>

❗Quando (e somente quando) você já tiver coletado TODAS as informações E o cliente tiver confirmado no Checkpoint:

🔒 **NÃO envie JSON visível para o usuário!** Em vez disso:
1. Envie uma mensagem de despedida amigável agradecendo e confirmando que o vendedor vai entrar em contato
2. No final da mensagem, adicione a tag [COMPLETE] seguida do JSON em uma única linha (isso será processado internamente e não aparecerá para o usuário)

📦 Exemplo de resposta correta:

"Perfeito! Vou encaminhar todas as informações para o time de vendas e eles vão te contatar pelo WhatsApp! 🚀 Obrigada pelo seu tempo! 😄✨

[COMPLETE]{"ready":true,"name":"Nome da empresa","email":"email@email.com","phone":"5511999999999","cnpj":"12345678000190","cliente":"Revenda","origin":"site","produto":"discos e serras","quantidade":"200","prazo":"agora"}"

</instrucoes-saida>`;
    }
}

const service = new MarciaAgentService();
service.MarciaAgentService = MarciaAgentService; // Expose class for testing
module.exports = service;
