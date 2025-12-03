const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Serviço de integração com RD Station CRM
 * Cria oportunidades e marca como perdido
 */

class RDStationService {
    constructor() {
        // API v1 aceita token da instância diretamente
        this.apiUrl = 'https://crm.rdstation.com/api/v1';
        this.token = process.env.RD_STATION_API_TOKEN;

        if (!this.token) {
            logger.error('Token do RD Station não configurado! Configure RD_STATION_API_TOKEN no arquivo .env');
        }
    }

    /**
     * Verifica se o serviço está configurado
     * @returns {boolean}
     */
    isConfigured() {
        return !!this.token;
    }

    /**
     * Cria headers para requisições à API v1
     * @returns {Object}
     */
    getHeaders() {
        return {
            'Content-Type': 'application/json'
        };
    }

    /**
     * Adiciona token como query parameter (API v1)
     * @param {string} url - URL base
     * @returns {string} - URL com token
     */
    addTokenToUrl(url) {
        return `${url}?token=${this.token}`;
    }

    /**
     * Busca uma organização pelo nome (Razão Social)
     * @param {string} name - Razão Social
     * @param {boolean} requireExact - Se true, exige correspondência exata (case insensitive)
     * @returns {Promise<string|null>} - ID da organização ou null
     */
    async searchOrganization(name, requireExact = true) {
        try {
            const response = await axios.get(
                this.addTokenToUrl(`${this.apiUrl}/organizations`),
                {
                    params: { q: name },
                    headers: this.getHeaders()
                }
            );

            logger.info('Resultado da busca de organização', {
                termo: name,
                encontrados: response.data.organizations ? response.data.organizations.length : 0,
                nomes: response.data.organizations ? response.data.organizations.map(o => o.name) : []
            });

            if (response.data && response.data.organizations && response.data.organizations.length > 0) {
                // Filtra para encontrar correspondência EXATA de nome (case insensitive)
                const exactMatch = response.data.organizations.find(
                    org => org.name.trim().toLowerCase() === name.trim().toLowerCase()
                );

                if (exactMatch) {
                    return exactMatch.id;
                }

                // Se não exige exata e tem resultados, tenta encontrar algo parecido
                if (!requireExact) {
                    // Tenta encontrar um que contenha o nome ou seja contido pelo nome
                    const fuzzyMatch = response.data.organizations.find(
                        org => org.name.trim().toLowerCase().includes(name.trim().toLowerCase()) ||
                            name.trim().toLowerCase().includes(org.name.trim().toLowerCase())
                    );

                    if (fuzzyMatch) {
                        logger.info('Encontrado match aproximado', {
                            buscado: name,
                            encontrado: fuzzyMatch.name,
                            id: fuzzyMatch.id
                        });
                        return fuzzyMatch.id;
                    }

                    logger.warn('Nenhum match aproximado encontrado nos resultados da busca', {
                        buscado: name,
                        resultados: response.data.organizations.map(o => o.name)
                    });
                }
            }
            return null;
        } catch (error) {
            logger.error('Erro ao buscar organização', { error: error.message });
            return null;
        }
    }

    /**
     * Cria uma nova organização
     * @param {Object} empresa - Dados da empresa
     * @returns {Promise<string>} - ID da organização criada
     */
    async createOrganization(empresa) {
        try {
            const payload = {
                organization: {
                    name: empresa.razaoSocial,
                    resume: `CNPJ: ${empresa.cnpjFormatado}\nFantasia: ${empresa.nomeFantasia}`,
                    address: `${empresa.logradouro}, ${empresa.numero} - ${empresa.bairro}`,
                    email: empresa.email,
                    phones: [empresa.ddd + empresa.telefone]
                }
            };

            const response = await axios.post(
                this.addTokenToUrl(`${this.apiUrl}/organizations`),
                payload,
                { headers: this.getHeaders() }
            );

            return response.data.id;
        } catch (error) {
            // Se erro for 422 (Empresa já cadastrada)
            if (error.response && error.response.status === 422) {
                logger.warn('Empresa já cadastrada (422). Iniciando tentativa de recuperação de ID...', { nome: empresa.razaoSocial });

                // Tenta recuperar com retries para dar tempo de indexação
                // Aumentando para 5 tentativas com delays maiores (Total ~30s)
                for (let i = 0; i < 5; i++) {
                    // Espera: 2s, 4s, 6s, 8s, 10s
                    const delay = (i + 1) * 2000;

                    logger.info(`Tentativa ${i + 1}/5 de recuperação. Aguardando ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));

                    // Tenta buscar novamente, aceitando match aproximado
                    const existingId = await this.searchOrganization(empresa.razaoSocial, false);

                    if (existingId) {
                        logger.info('ID da organização recuperado com sucesso', { existingId });
                        return existingId;
                    }
                }

                logger.error('Falha ao recuperar ID da organização existente após múltiplas tentativas');
            }

            logger.error('Erro ao criar organização', { error: error.message });
            throw error;
        }
    }

    /**
     * Cria um novo contato
     * @param {Object} lead - Dados do lead
     * @returns {Promise<string>} - ID do contato criado
     */
    async createContact(lead) {
        try {
            const payload = {
                contact: {
                    name: lead.name,
                    phones: [{ phone: lead.phone }],
                    emails: [{ email: lead.email || `${lead.name.replace(/\s+/g, '.').toLowerCase()}@exemplo.com` }] // Email fictício se não houver
                }
            };

            const response = await axios.post(
                this.addTokenToUrl(`${this.apiUrl}/contacts`),
                payload,
                { headers: this.getHeaders() }
            );

            return response.data.id;
        } catch (error) {
            logger.error('Erro ao criar contato', { error: error.message });
            throw error;
        }
    }

    /**
     * Cria uma oportunidade (deal) no RD Station CRM
     * @param {Object} leadData - Dados do lead processado
     * @returns {Promise<Object>} - Resposta da API
     */
    async createDeal(leadData) {
        if (!this.isConfigured()) {
            logger.error('RD Station não configurado. Pulando criação de deal.');
            return {
                success: false,
                message: 'RD Station não configurado',
                mode: 'test'
            };
        }

        try {
            const { lead, empresa, validacao } = leadData;

            // PASSO 0: Gerenciar Organização e Contato
            let organizationId = await this.searchOrganization(empresa.razaoSocial);
            if (!organizationId) {
                logger.info('Organização não encontrada (ou nome diferente), criando nova...', { nome: empresa.razaoSocial });
                organizationId = await this.createOrganization(empresa);
            } else {
                logger.info('Organização encontrada, vinculando...', { id: organizationId });
            }

            logger.info('Criando contato...', { nome: lead.name });
            const contactId = await this.createContact(lead);

            // Determina Source e Campaign baseado na origem
            let dealSourceId, campaignId;
            const origem = lead.origin ? lead.origin.toLowerCase() : '';

            if (origem.includes('instagram') || origem.includes('insta')) {
                dealSourceId = '63d81a9a732aa3001738fd73'; // Redes Sociais
                campaignId = '64b82d4019f6fc001c8c89bb'; // Tráfego Pago
            } else {
                // Default para Site (Google/Busca/Outros)
                dealSourceId = '6478af40d3422a0012d73a7e'; // Site
                campaignId = '68cd8a3eebdea4001c02960f'; // Google ADS
            }

            // PASSO 1: Criar o deal SEM vínculos (só campos básicos)
            const dealPayload = {
                deal: {
                    name: `${lead.origin || 'Origem Desconhecida'} - ${empresa.razaoSocial} - ${empresa.cnpjFormatado}`,
                    deal_pipeline_id: '63d81825906fa10010e05051',
                    deal_stage_id: '6478a01a95b902000dc981ec',
                    user_id: '63d3f64aa6528000185e5ddd',
                    deal_custom_fields: [
                        {
                            custom_field_id: '67a4c29d9207d10020ee88cb',
                            value: validacao.qualificado ? 'true' : 'false'
                        }
                    ]
                }
            };

            logger.info('Criando deal no RD Station (sem vínculos)', {
                empresa: empresa.razaoSocial
            });

            const createResponse = await axios.post(
                this.addTokenToUrl(`${this.apiUrl}/deals`),
                dealPayload,
                { headers: this.getHeaders(), timeout: 15000 }
            );

            const dealId = createResponse.data.id;
            logger.info('Deal criado com sucesso', { dealId });

            // PASSO 2: Vincular Organização (PUT separado)
            try {
                logger.info('Vinculando organização ao deal...', { dealId, organizationId });
                await axios.put(
                    this.addTokenToUrl(`${this.apiUrl}/deals/${dealId}`),
                    {
                        deal: {
                            organization_id: organizationId
                        }
                    },
                    { headers: this.getHeaders(), timeout: 15000 }
                );
                logger.info('✅ Organização vinculada com sucesso');
            } catch (err) {
                logger.error('❌ Erro ao vincular organização', { error: err.message });
            }

            // PASSO 3: Vincular Deal ao Contato (PUT no contato com deal_ids)
            try {
                logger.info('Vinculando deal ao contato...', { dealId, contactId });
                await axios.put(
                    this.addTokenToUrl(`${this.apiUrl}/contacts/${contactId}`),
                    {
                        deal_ids: [dealId]
                    },
                    { headers: this.getHeaders(), timeout: 15000 }
                );
                logger.info('✅ Deal vinculado ao contato com sucesso');
            } catch (err) {
                logger.error('❌ Erro ao vincular deal ao contato', {
                    error: err.message,
                    response: err.response?.data
                });
            }

            // PASSO 4: Atualizar fonte e campanha
            if (dealSourceId || campaignId) {
                const updatePayload = {
                    deal: {}
                };

                if (dealSourceId) updatePayload.deal.deal_source_id = dealSourceId;
                if (campaignId) updatePayload.deal.campaign_id = campaignId;

                logger.info('Atualizando deal com fonte e campanha', { dealId });
                try {
                    await axios.put(
                        this.addTokenToUrl(`${this.apiUrl}/deals/${dealId}`),
                        updatePayload,
                        { headers: this.getHeaders(), timeout: 15000 }
                    );
                    logger.info('Deal atualizado com fonte e campanha');
                } catch (err) {
                    logger.error('Erro ao atualizar fonte/campanha', { error: err.message });
                }
            }

            // PASSO 5: Criar anotação com informações do CNPJ
            await this.createDealNote(dealId, leadData);

            return {
                success: true,
                dealId: dealId,
                data: createResponse.data
            };

        } catch (error) {
            logger.error('Erro ao criar deal no RD Station', {
                error: error.message,
                response: error.response?.data
            });

            throw new Error(`Erro ao criar deal no RD Station: ${error.message}`);
        }
    }

    async createDealNote(dealId, leadData) {
        try {
            const { lead, empresa, validacao } = leadData;

            // Formata CNAEs secundários
            let cnaesSecundariosTexto = '';
            if (empresa.cnaesSecundarios && empresa.cnaesSecundarios.length > 0) {
                cnaesSecundariosTexto = empresa.cnaesSecundarios
                    .map(cnae => `   • ${cnae.codigo} - ${cnae.descricao}`)
                    .join('\\n');
            } else {
                cnaesSecundariosTexto = '   Nenhum CNAE secundário';
            }

            // Adiciona resumo da conversa se disponível
            let conversationSummary = '';
            if (leadData.conversationSummary) {
                conversationSummary = `

💬 RESUMO DA CONVERSA COM A MÁRCIA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${leadData.conversationSummary}
`;
            }

            // Monta o texto da anotação
            const noteContent = `
📊 INFORMAÇÕES DO CNPJ - Qualificação Automática

🏢 DADOS DA EMPRESA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Razão Social: ${empresa.razaoSocial}
• Nome Fantasia: ${empresa.nomeFantasia}
• CNPJ: ${empresa.cnpjFormatado}
• Porte: ${empresa.porte || 'Não informado'}
• Natureza Jurídica: ${empresa.naturezaJuridica || 'Não informado'}
• Capital Social: ${empresa.capitalSocial ? `R$ ${empresa.capitalSocial.toLocaleString('pt-BR')}` : 'Não informado'}

📍 ENDEREÇO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${empresa.logradouro}, ${empresa.numero || 'S/N'}
${empresa.complemento ? empresa.complemento + '\\n' : ''}${empresa.bairro} - ${empresa.municipio}/${empresa.uf}
CEP: ${empresa.cep}

📞 CONTATO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Telefone Lead: ${lead.phone}
• Email: ${empresa.email || 'Não informado'}
• DDD: ${empresa.ddd || 'Não informado'}

🏭 ATIVIDADE ECONÔMICA (CNAE):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 CNAE Principal:
   ${empresa.cnaePrincipal.codigo} - ${empresa.cnaePrincipal.descricao}

📋 CNAEs Secundários:
${cnaesSecundariosTexto}

✅ RESULTADO DA QUALIFICAÇÃO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Status: ${validacao.qualificado ? '✅ QUALIFICADO' : '❌ NÃO QUALIFICADO'}
Motivo: ${validacao.motivo}
${validacao.cnaeMatch ? `CNAE Match: ${validacao.cnaeMatch.codigo} - ${validacao.cnaeMatch.descricao}` : ''}
${conversationSummary}
📥 ORIGEM DO LEAD:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fonte: ${lead.origin || 'Não informado'}
Data: ${new Date().toLocaleString('pt-BR')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 Anotação gerada automaticamente pelo sistema de qualificação de leads
            `.trim();

            const notePayload = {
                activity: {
                    deal_id: dealId,
                    user_id: '63d3f64aa6528000185e5ddd', // BEATRIZ
                    type: 'note',
                    text: noteContent
                }
            };

            logger.info('Criando anotação no deal (via activities)', { dealId });

            await axios.post(
                this.addTokenToUrl(`${this.apiUrl}/activities`),
                notePayload,
                { headers: this.getHeaders(), timeout: 15000 }
            );

            logger.info('Anotação criada com sucesso no deal');

        } catch (error) {
            logger.error('Erro ao criar anotação no deal', {
                error: error.message,
                response: error.response?.data
            });
            // Não lança erro para não interromper o fluxo principal
        }
    }

    /**
     * Marca uma oportunidade como perdida
     * @param {string} dealId - ID do deal no RD Station
     * @param {string} motivo - Motivo da perda
     * @returns {Promise<Object>} - Resposta da API
     */
    async markAsLost(dealId, motivo = 'CNAE fora do PCI') {
        if (!this.isConfigured()) {
            logger.error('RD Station não configurado. Pulando marcação como perdido.');
            return {
                success: false,
                message: 'RD Station não configurado',
                mode: 'test'
            };
        }

        try {
            const payload = {
                deal: {
                    deal_lost_reason_id: '67c993e56a9a7f0017f83aba', // CNAE Fora do Escopo
                    lost_reason: motivo
                }
            };

            logger.info(`Marcando deal ${dealId} como perdido`, { motivo });

            const response = await axios.put(
                this.addTokenToUrl(`${this.apiUrl}/deals/${dealId}/lost`),
                payload,
                { headers: this.getHeaders(), timeout: 15000 }
            );

            logger.info(`Deal ${dealId} marcado como perdido com sucesso`);

            return {
                success: true,
                data: response.data
            };

        } catch (error) {
            logger.error(`Erro ao marcar deal ${dealId} como perdido`, {
                error: error.message,
                response: error.response?.data
            });

            throw new Error(`Erro ao marcar como perdido: ${error.message}`);
        }
    }

    /**
     * Processa lead completo: cria deal e marca como perdido se necessário
     * @param {Object} leadData - Dados do lead processado
     * @returns {Promise<Object>} - Resultado do processamento
     */
    async processLead(leadData) {
        try {
            const { validacao } = leadData;

            // Cria o deal
            const dealResult = await this.createDeal(leadData);

            // Se não qualificado, marca como perdido
            if (!validacao.qualificado && dealResult.success && dealResult.dealId) {
                await this.markAsLost(dealResult.dealId, validacao.motivo);
            }

            return {
                success: true,
                dealCreated: dealResult.success,
                dealId: dealResult.dealId,
                markedAsLost: !validacao.qualificado
            };

        } catch (error) {
            logger.error('Erro ao processar lead no RD Station', { error: error.message });
            throw error;
        }
    }
}

module.exports = new RDStationService();
