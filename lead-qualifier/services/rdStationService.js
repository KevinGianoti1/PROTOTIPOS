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

            // Determina Source e Campaign baseado na origem
            let dealSourceId, campaignId;
            if (lead.origem === 'Instagram') {
                dealSourceId = '63d81a9a732aa3001738fd73'; // Redes Sociais
                campaignId = '64b82d4019f6fc001c8c89bb'; // Tráfego Pago
            } else if (lead.origem === 'Site') {
                dealSourceId = '6478af40d3422a0012d73a7e'; // Site
                campaignId = '68cd8a3eebdea4001c02960f'; // Google ADS
            }

            // PASSO 1: Criar o deal com campos básicos
            const dealPayload = {
                deal: {
                    name: `${lead.nome} - ${empresa.nomeFantasia} (${empresa.cnpjFormatado})`,
                    deal_pipeline_id: '63d81825906fa10010e05051', // Funil de Clientes Novos
                    deal_stage_id: '6478a01a95b902000dc981ec', // Entrada Tráfego Pago (ETP)
                    user_id: '63d3f64aa6528000185e5ddd', // BEATRIZ
                    deal_custom_fields: [
                        {
                            custom_field_id: '67a4c29d9207d10020ee88cb', // Campo CNAE
                            value: validacao.qualificado ? 'true' : 'false'
                        }
                    ]
                }
            };

            logger.info('Criando deal no RD Station', {
                empresa: empresa.razaoSocial,
                qualificado: validacao.qualificado,
                origem: lead.origem
            });

            const createResponse = await axios.post(
                this.addTokenToUrl(`${this.apiUrl}/deals`),
                dealPayload,
                { headers: this.getHeaders(), timeout: 15000 }
            );

            const dealId = createResponse.data.id;
            logger.info('Deal criado com sucesso', { dealId });

            // PASSO 2: Atualizar o deal com Source e Campaign
            if (dealSourceId || campaignId) {
                const updatePayload = {
                    deal: {}
                };

                if (dealSourceId) {
                    updatePayload.deal.deal_source_id = dealSourceId;
                }
                if (campaignId) {
                    updatePayload.deal.campaign_id = campaignId;
                }

                logger.info('Atualizando deal com fonte e campanha', {
                    dealId,
                    source_id: dealSourceId,
                    campaign_id: campaignId
                });

                await axios.put(
                    this.addTokenToUrl(`${this.apiUrl}/deals/${dealId}`),
                    updatePayload,
                    { headers: this.getHeaders(), timeout: 15000 }
                );

                logger.info('Deal atualizado com fonte e campanha');
            }

            // PASSO 3: Criar anotação com informações do CNPJ
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

    /**
     * Cria uma anotação no deal com informações do CNPJ
     * @param {string} dealId - ID do deal
     * @param {Object} leadData - Dados do lead processado
     * @returns {Promise<void>}
     */
    async createDealNote(dealId, leadData) {
        try {
            const { lead, empresa, validacao } = leadData;

            // Formata CNAEs secundários
            let cnaesSecundariosTexto = '';
            if (empresa.cnaesSecundarios && empresa.cnaesSecundarios.length > 0) {
                cnaesSecundariosTexto = empresa.cnaesSecundarios
                    .map(cnae => `   • ${cnae.codigo} - ${cnae.descricao}`)
                    .join('\n');
            } else {
                cnaesSecundariosTexto = '   Nenhum CNAE secundário';
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
${empresa.complemento ? empresa.complemento + '\n' : ''}${empresa.bairro} - ${empresa.municipio}/${empresa.uf}
CEP: ${empresa.cep}

📞 CONTATO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Telefone Lead: ${lead.telefone}
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

📥 ORIGEM DO LEAD:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fonte: ${lead.origem}
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
