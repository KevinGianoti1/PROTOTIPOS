const { CNAES_PERMITIDOS, CNAES_DESCRICOES } = require('../config/cnaes');
const logger = require('../utils/logger');

/**
 * Serviço de validação de leads
 * Verifica se o CNAE da empresa está no PCI
 */

class ValidationService {
    /**
     * Normaliza código CNAE (remove pontos, traços, etc)
     * @param {string} cnae - Código CNAE
     * @returns {string} - CNAE normalizado
     */
    normalizeCNAE(cnae) {
        return cnae.toString().replace(/\D/g, '');
    }

    /**
     * Verifica se um CNAE está na lista permitida
     * @param {string} cnae - Código CNAE para verificar
     * @returns {boolean} - True se está permitido
     */
    isCNAEPermitido(cnae) {
        const normalizedCNAE = this.normalizeCNAE(cnae);
        return CNAES_PERMITIDOS.includes(normalizedCNAE);
    }

    /**
     * Valida se a empresa está no PCI baseado nos CNAEs
     * @param {Object} empresaData - Dados da empresa obtidos pela consulta CNPJ
     * @returns {Object} - Resultado da validação
     */
    validarPCI(empresaData) {
        logger.info(`Validando PCI para empresa: ${empresaData.razaoSocial}`);

        const resultado = {
            qualificado: false,
            motivo: '',
            cnaeMatch: null,
            detalhes: {
                razaoSocial: empresaData.razaoSocial,
                cnpj: empresaData.cnpjFormatado,
                cnaePrincipal: empresaData.cnaePrincipal
            }
        };

        // Verifica CNAE principal
        if (this.isCNAEPermitido(empresaData.cnaePrincipal.codigo)) {
            resultado.qualificado = true;
            resultado.cnaeMatch = empresaData.cnaePrincipal;
            resultado.motivo = `CNAE principal (${empresaData.cnaePrincipal.codigo}) está no PCI: ${empresaData.cnaePrincipal.descricao}`;

            logger.info(`✅ Lead QUALIFICADO - ${resultado.motivo}`);
            return resultado;
        }

        // Verifica CNAEs secundários
        for (const cnae of empresaData.cnaesSecundarios) {
            if (this.isCNAEPermitido(cnae.codigo)) {
                resultado.qualificado = true;
                resultado.cnaeMatch = cnae;
                resultado.motivo = `CNAE secundário (${cnae.codigo}) está no PCI: ${cnae.descricao}`;

                logger.info(`✅ Lead QUALIFICADO - ${resultado.motivo}`);
                return resultado;
            }
        }

        // Nenhum CNAE corresponde ao PCI
        resultado.qualificado = false;
        resultado.motivo = `CNAE principal (${empresaData.cnaePrincipal.codigo}) e secundários não estão no PCI`;

        logger.info(`❌ Lead NÃO QUALIFICADO - ${resultado.motivo}`);
        return resultado;
    }

    /**
     * Retorna lista de CNAEs permitidos com descrições
     * @returns {Array} - Lista de CNAEs
     */
    getCNAEsPermitidos() {
        return CNAES_PERMITIDOS.map(cnae => ({
            codigo: cnae,
            descricao: CNAES_DESCRICOES[cnae] || 'Descrição não disponível'
        }));
    }

    /**
     * Processa lead completo (consulta + validação)
     * Esta função orquestra todo o fluxo de validação
     * @param {Object} leadData - Dados do lead { cnpj, nome, telefone, origem }
     * @param {Object} cnpjService - Serviço de consulta CNPJ
     * @returns {Promise<Object>} - Resultado completo da validação
     */
    async processarLead(leadData, cnpjService) {
        try {
            logger.info('Iniciando processamento de lead', {
                cnpj: leadData.cnpj,
                origem: leadData.origem
            });

            // 1. Consulta dados do CNPJ
            const empresaData = await cnpjService.consultarCNPJ(leadData.cnpj);

            // 2. Valida contra PCI
            const validacao = this.validarPCI(empresaData);

            // 3. Monta resultado completo
            const resultado = {
                lead: {
                    nome: leadData.nome,
                    telefone: leadData.telefone,
                    origem: leadData.origem
                },
                empresa: empresaData,
                validacao: validacao,
                timestamp: new Date().toISOString()
            };

            return resultado;

        } catch (error) {
            logger.error('Erro ao processar lead', { error: error.message });
            throw error;
        }
    }
}

module.exports = new ValidationService();
