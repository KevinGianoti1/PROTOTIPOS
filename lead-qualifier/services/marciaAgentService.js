require('dotenv').config();
const OpenAI = require('openai');
const logger = require('../utils/logger');
const cnpjService = require('./cnpjService');
const validationService = require('./validationService');
const rdStationService = require('./rdStationService');
const databaseService = require('./databaseService');

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
            this.openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });
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

            // Adiciona mensagem do usuário ao histórico
            await databaseService.addMessage(phoneNumber, 'user', message);

            // Recupera histórico para o prompt
            const history = await databaseService.getHistory(phoneNumber);

            // Chama OpenAI
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: this.getSystemPrompt() },
                    ...history
                ],
                temperature: 0.7,
                max_tokens: 1200
            });

            const assistantMessage = completion.choices[0].message.content;

            // Adiciona resposta ao histórico
            await databaseService.addMessage(phoneNumber, 'assistant', assistantMessage);

            // Tenta extrair dados estruturados da resposta
            const extractedData = this.extractDataFromResponse(assistantMessage);

            // Atualiza dados coletados no cache do contato
            const currentData = contact.data_cache || {};
            const updatedData = { ...currentData, ...extractedData };

            await databaseService.updateContact(phoneNumber, {
                data_cache: updatedData,
                // Se extraiu CNPJ ou Nome, já salva nas colunas dedicadas também para facilitar busca
                ...(extractedData.cnpj && { cnpj: extractedData.cnpj }),
                ...(extractedData.name && { name: extractedData.name }),
                ...(extractedData.email && { email: extractedData.email })
            });

            // Verifica se a coleta está completa
            if (extractedData.ready === true) {
                logger.info('✅ Coleta completa para', phoneNumber);

                // Processa o lead
                await this.processCompleteLead(phoneNumber, updatedData);
            }

            return assistantMessage;

        } catch (error) {
            logger.error('Erro ao processar mensagem:', error);
            return 'Ops! Tive um probleminha aqui 😅 Pode repetir?';
        }
    }

    /**
     * Processa lead com dados completos
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

            // 3. Gera resumo da conversa do histórico
            const history = await databaseService.getHistory(phoneNumber);
            let conversationSummary = '';
            if (history) {
                conversationSummary = history
                    .map(msg => `${msg.role === 'user' ? '👤 Cliente' : '🤖 Márcia'}: ${msg.content}`)
                    .join('\n\n');
            }

            // 4. Prepara dados para o RD Station
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
                    ddd: empresaData.telefone.match(/\\((\\d{2})\\)/)?.[1] || '',
                    telefone: empresaData.telefone.replace(/\\D/g, '')
                },
                validacao: {
                    qualificado: true,
                    motivo: 'CNAE aprovado pela Márcia',
                    cnaeMatch: empresaData.cnaePrincipal
                },
                conversationSummary: conversationSummary
            };

            // 5. Cria no RD Station
            const result = await rdStationService.processLead(leadData);

            logger.info('✅ Lead processado com sucesso:', result);

            // Marca como completado no DB (não deleta para manter histórico)
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

        // Tenta encontrar JSON na resposta
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                return parsed;
            } catch (e) {
                // Não é JSON válido, continua com regex
            }
        }

        // Extração por regex (fallback)
        const patterns = {
            cnpj: /CNPJ[:\s]+([0-9.\/\-]{14,18})/i,
            name: /Nome[\/\s]+Empresa[:\s]+([^\n]+)/i,
            phone: /Telefone[:\s]+([0-9\s\-\(\)]+)/i,
            email: /E-mail[:\s]+([^\s\n]+@[^\s\n]+)/i,
            origin: /Origem(?:\s+do\s+contato)?[:\s]+([^\n]+)/i,
            produto: /Produto[:\s]+([^\n]+)/i,
            quantidade: /Quantidade[:\s]+([0-9]+)/i,
            prazo: /Prazo(?:\s+de\s+compra)?[:\s]+([^\n]+)/i
        };

        for (const [key, pattern] of Object.entries(patterns)) {
            const match = response.match(pattern);
            if (match) {
                let value = match[1].trim();

                // Limpa prefixos comuns
                value = value.replace(/^(do\s+contato:\s*|de\s+compra:\s*)/i, '');

                data[key] = value;
            }
        }

        // Verifica se está pronto (todos os campos obrigatórios)
        if (data.cnpj && data.name && data.phone) {
            data.ready = true;
        }

        return data;
    }

    /**
     * Retorna o prompt do sistema (baseado no N8N)
     */
    getSystemPrompt() {
        return `<contexto>
Você é "Márcia 😄", SDR da Maxi Force Ferramentas Diamantadas.  
Seu papel é conversar com leads de forma leve, simpática e inteligente, coletar as informações necessárias e encaminhar ao time de vendas.  
Você entende o básico sobre discos, serras, lixas e brocas diamantadas e suas aplicações em porcelanato, granito, quartzo, madeira e inox.  

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
Peça o e-mail de contato (opcional).  

6. **Perfil da empresa:**  
Pergunte se são distribuidora, revenda ou lojista.  

7. **Origem do contato:**  
Pergunte como chegou até a Maxi Force (Instagram, site, indicação).  

8. **Produto e aplicação:**  
Pergunte o que o cliente procura e como utiliza.  

9. **Quantidade e prazo:**  
Pergunte quantos produtos compram normalmente e quando pensam em comprar.  

10. **Resumo e confirmação final:**  
Antes de encerrar, faça sempre um resumo completo:  
"Show, [nome]! 😄 Então ficou assim:  
🔹 CNPJ: [CNPJ]  
🔹 Nome / Empresa: [nome]  
🔹 Telefone: [telefone]  
🔹 E-mail: [email]  
🔹 Perfil: [perfil]  
🔹 Origem do contato: [origem]  
🔹 Produto: [produto]  
🔹 Quantidade média: [quantidade]  
🔹 Prazo de compra: [prazo]  
Tudo certinho? 🙌"  

</tarefas>

<instrucoes-saida>

❗Quando (e somente quando) você já tiver coletado TODAS as seguintes informações:

- Nome do responsável ou empresa  
- E-mail de contato (ou confirmado que não tem)  
- Telefone com DDI (ex: 5511999999999)  
- CNPJ válido (14 dígitos)  
- Tipo de cliente (Distribuidora, Revenda ou Lojista)  
- Origem do contato  
- Produto desejado  
- Quantidade média comprada  
- Prazo de compra  

🔒 Sua resposta final **deve incluir um JSON** no final da mensagem:

{
  "ready": true,
  "name": "Nome da empresa ou responsável",
  "email": "email@email.com",
  "phone": "5511999999999",
  "cnpj": "12345678000190",
  "cliente": "Revenda",
  "origin": "WhatsApp",
  "produto": "discos para granito",
  "quantidade": "200",
  "prazo": "agora"
}

</instrucoes-saida>`;
    }
}

module.exports = new MarciaAgentService();
