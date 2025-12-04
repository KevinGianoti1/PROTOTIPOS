const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Serviço para consulta de dados de CNPJ
 * Usa a BrasilAPI - API pública e gratuita
 */

class CNPJService {
    constructor() {
        this.apiUrl = 'https://brasilapi.com.br/api/cnpj/v1';
    }

    /**
     * Remove formatação do CNPJ (deixa só números)
     * @param {string} cnpj - CNPJ formatado ou não
     * @returns {string} - CNPJ apenas com números
     */
    cleanCNPJ(cnpj) {
        if (!cnpj) return '';
        return String(cnpj).replace(/\D/g, '');
    }

    /**
     * Valida formato básico do CNPJ
     * @param {string} cnpj - CNPJ para validar
     * @returns {boolean} - True se válido
     */
    isValidFormat(cnpj) {
        const cleaned = this.cleanCNPJ(cnpj);
        return cleaned.length === 14 && /^\d+$/.test(cleaned);
    }

    /**
     * Consulta dados da empresa pelo CNPJ
     * @param {string} cnpj - CNPJ da empresa
     * @returns {Promise<Object>} - Dados da empresa
     */
    async consultarCNPJ(cnpj) {
        try {
            const cleanedCNPJ = this.cleanCNPJ(cnpj);

            // Valida formato
            if (!this.isValidFormat(cnpj)) {
                throw new Error('CNPJ inválido: formato incorreto');
            }

            logger.info(`Consultando CNPJ: ${cleanedCNPJ}`);

            // Consulta API
            const response = await axios.get(`${this.apiUrl}/${cleanedCNPJ}`, {
                timeout: 10000 // 10 segundos
            });

            const data = response.data;

            // Formata resposta
            const empresaData = {
                cnpj: data.cnpj,
                razaoSocial: data.razao_social,
                nomeFantasia: data.nome_fantasia || data.razao_social,
                cnpjFormatado: this.formatCNPJ(data.cnpj),
                situacaoCadastral: data.descricao_situacao_cadastral,
                dataAbertura: data.data_inicio_atividade,
                cnaePrincipal: {
                    codigo: data.cnae_fiscal.toString(),
                    descricao: data.cnae_fiscal_descricao
                },
                cnaesSecundarios: (data.cnaes_secundarios || []).map(cnae => ({
                    codigo: cnae.codigo.toString(),
                    descricao: cnae.descricao
                })),
                endereco: {
                    logradouro: data.logradouro,
                    numero: data.numero,
                    complemento: data.complemento,
                    bairro: data.bairro,
                    municipio: data.municipio,
                    uf: data.uf,
                    cep: data.cep
                },
                telefone: this.formatTelefone(data.ddd_telefone_1),
                email: data.email || '',
                capitalSocial: data.capital_social,
                porte: data.porte,
                naturezaJuridica: data.natureza_juridica
            };

            logger.info(`CNPJ consultado com sucesso: ${empresaData.razaoSocial}`);
            return empresaData;

        } catch (error) {
            if (error.response && error.response.status === 404) {
                logger.error(`CNPJ não encontrado: ${cnpj}`);
                throw new Error('CNPJ não encontrado na base de dados da Receita Federal');
            }

            logger.error(`Erro ao consultar CNPJ: ${cnpj}`, { error: error.message });
            throw new Error(`Erro ao consultar CNPJ: ${error.message}`);
        }
    }

    /**
     * Formata CNPJ para exibição
     * @param {string} cnpj - CNPJ sem formatação
     * @returns {string} - CNPJ formatado (00.000.000/0000-00)
     */
    formatCNPJ(cnpj) {
        const cleaned = this.cleanCNPJ(cnpj);
        return cleaned.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    }

    /**
     * Formata telefone para exibição
     * @param {string} telefone - Telefone sem formatação
     * @returns {string} - Telefone formatado
     */
    formatTelefone(telefone) {
        if (!telefone) return '';
        const cleaned = telefone.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return cleaned.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
        }
        if (cleaned.length === 11) {
            return cleaned.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
        }
        return telefone;
    }
}

module.exports = new CNPJService();
