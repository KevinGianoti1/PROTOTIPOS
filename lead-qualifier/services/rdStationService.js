const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Serviço de integração com RD Station CRM
 * Cria oportunidades e marca como perdido
 */

class RDStationService {
    constructor() {
        // API v2 usa endpoint diferente
        this.apiUrl = 'https://api.rd.services/crm/v2';
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
     * Cria headers para requisições à API
     * @returns {Object}
     */
    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
        };
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

            // Payload simplificado para API v2
            const dealPayload = {
                name: `${lead.nome} - ${empresa.nomeFantasia}`,
                status: 'ongoing', // API v2 só aceita 'ongoing' na criação
                custom_fields: {
                    cnpj: empresa.cnpjFormatado,
                    cnae_principal: empresa.cnaePrincipal.codigo,
                    cnae_descricao: empresa.cnaePrincipal.descricao,
                    origem: lead.origem,
                    qualificado: validacao.qualificado ? 'Sim' : 'Não',
                    motivo_qualificacao: validacao.motivo,
                    telefone: lead.telefone,
                    razao_social: empresa.razaoSocial
                }
            };

            logger.info('Criando deal no RD Station', {
                empresa: empresa.razaoSocial,
                qualificado: validacao.qualificado
            });

            const response = await axios.post(
                `${this.apiUrl}/deals`,
                dealPayload,
                { headers: this.getHeaders(), timeout: 15000 }
            );

            logger.info('Deal criado com sucesso no RD Station', { dealId: response.data._id });

            return {
                success: true,
                dealId: response.data._id,
                data: response.data
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
                    deal_stage_id: null, // ID da etapa "Perdido"
                    lost_reason: motivo
                }
            };

            logger.info(`Marcando deal ${dealId} como perdido`, { motivo });

            const response = await axios.put(
                `${this.apiUrl}/deals/${dealId}`,
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
