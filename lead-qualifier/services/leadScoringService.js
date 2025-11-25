const logger = require('../utils/logger');
const databaseService = require('./databaseService');

/**
 * Lead Scoring Service
 * Calcula score automático para leads baseado em múltiplos fatores
 * Score: 0-100
 * Temperatura: Quente (>=70), Morno (40-69), Frio (<40)
 */

class LeadScoringService {
    constructor() {
        // Pesos para cada fator (total = 1.0)
        this.weights = {
            cnae: 0.30,        // CNAE válido e relevante
            companySize: 0.20, // Porte da empresa
            responseTime: 0.15,// Velocidade de resposta
            messageQuality: 0.15, // Qualidade das mensagens
            productInterest: 0.10, // Produto de interesse definido
            engagement: 0.10   // Nível de engajamento
        };

        // Lista de CNAEs de alto valor (pode ser expandida)
        this.highValueCNAEs = [
            '4330-4', // Instalações elétricas
            '4399-1', // Serviços especializados para construção
            '2511-0', // Fabricação de estruturas metálicas
            '2512-8', // Fabricação de esquadrias de metal
            '2542-0', // Fabricação de artigos de serralheria
            '4120-4', // Construção de edifícios
            '4211-1', // Construção de rodovias e ferrovias
            '4221-9', // Obras para geração e distribuição de energia
            '4292-8', // Montagem de estruturas metálicas
            '3311-2', // Manutenção e reparação de máquinas
        ];
    }

    /**
     * Calcula o score de um lead
     * @param {Object} contact - Objeto do contato do banco de dados
     * @returns {number} Score de 0 a 100
     */
    async calculateScore(contact) {
        let totalScore = 0;

        // 1. Score de CNAE (30%)
        const cnaeScore = this.scoreCNAE(contact);
        totalScore += cnaeScore * this.weights.cnae;

        // 2. Score de Porte da Empresa (20%)
        const sizeScore = this.scoreCompanySize(contact);
        totalScore += sizeScore * this.weights.companySize;

        // 3. Score de Tempo de Resposta (15%)
        const responseScore = this.scoreResponseTime(contact);
        totalScore += responseScore * this.weights.responseTime;

        // 4. Score de Qualidade das Mensagens (15%)
        const qualityScore = this.scoreMessageQuality(contact);
        totalScore += qualityScore * this.weights.messageQuality;

        // 5. Score de Interesse em Produto (10%)
        const productScore = this.scoreProductInterest(contact);
        totalScore += productScore * this.weights.productInterest;

        // 6. Score de Engajamento (10%)
        const engagementScore = this.scoreEngagement(contact);
        totalScore += engagementScore * this.weights.engagement;

        // Arredonda para inteiro
        return Math.round(totalScore);
    }

    /**
     * Score baseado no CNAE (0-100)
     */
    scoreCNAE(contact) {
        if (!contact.cnae_principal) return 0;

        // CNAE válido = 50 pontos base
        let score = contact.cnae_valido ? 50 : 0;

        // CNAE de alto valor = +50 pontos
        if (this.highValueCNAEs.includes(contact.cnae_principal)) {
            score += 50;
        } else if (contact.cnae_valido) {
            // CNAE válido mas não prioritário = +25 pontos
            score += 25;
        }

        return score;
    }

    /**
     * Score baseado no porte da empresa (0-100)
     */
    scoreCompanySize(contact) {
        if (!contact.porte_empresa) return 30; // Score médio se não informado

        const porteMap = {
            'MEI': 20,
            'ME': 40,
            'EPP': 70,
            'DEMAIS': 100
        };

        return porteMap[contact.porte_empresa] || 30;
    }

    /**
     * Score baseado no tempo de resposta (0-100)
     */
    scoreResponseTime(contact) {
        if (!contact.tempo_resposta_medio) return 50; // Score médio

        const avgTime = contact.tempo_resposta_medio; // em segundos

        // Menos de 5 minutos = 100
        if (avgTime < 300) return 100;
        // 5-15 minutos = 80
        if (avgTime < 900) return 80;
        // 15-30 minutos = 60
        if (avgTime < 1800) return 60;
        // 30-60 minutos = 40
        if (avgTime < 3600) return 40;
        // Mais de 1 hora = 20
        return 20;
    }

    /**
     * Score baseado na qualidade das mensagens (0-100)
     */
    scoreMessageQuality(contact) {
        let score = 50; // Base

        // Tem CNPJ = +20
        if (contact.cnpj) score += 20;

        // Tem email = +10
        if (contact.email) score += 10;

        // Tem produto de interesse = +10
        if (contact.produto_interesse) score += 10;

        // Tem prazo de compra = +10
        if (contact.prazo_compra) score += 10;

        return Math.min(score, 100);
    }

    /**
     * Score baseado no interesse em produto (0-100)
     */
    scoreProductInterest(contact) {
        let score = 0;

        // Tem produto de interesse = 50 pontos
        if (contact.produto_interesse) score += 50;

        // Tem quantidade estimada = +25 pontos
        if (contact.quantidade_estimada) score += 25;

        // Tem prazo de compra = +25 pontos
        if (contact.prazo_compra) score += 25;

        return score;
    }

    /**
     * Score baseado no engajamento (0-100)
     */
    scoreEngagement(contact) {
        let score = 0;

        const totalMsg = contact.total_mensagens || 0;

        // Mais mensagens = mais engajamento
        if (totalMsg >= 10) score += 40;
        else if (totalMsg >= 5) score += 30;
        else if (totalMsg >= 3) score += 20;
        else if (totalMsg >= 1) score += 10;

        // Enviou áudio = +20 (mais pessoal)
        if (contact.audio_recebido) score += 20;

        // Solicitou catálogo = +20 (interesse ativo)
        if (contact.catalogo_enviado) score += 20;

        // Tem ticket médio estimado = +20
        if (contact.ticket_medio && contact.ticket_medio > 0) score += 20;

        return Math.min(score, 100);
    }

    /**
     * Determina a temperatura baseado no score
     * @param {number} score - Score de 0 a 100
     * @returns {string} 'Quente', 'Morno' ou 'Frio'
     */
    getTemperature(score) {
        if (score >= 70) return 'Quente';
        if (score >= 40) return 'Morno';
        return 'Frio';
    }

    /**
     * Calcula e salva o score para um lead específico
     * @param {string} phone - Telefone do contato
     */
    async scoreContact(phone) {
        try {
            const contact = await databaseService.getContact(phone);
            if (!contact) {
                logger.warn(`Contato ${phone} não encontrado para scoring`);
                return null;
            }

            const score = await this.calculateScore(contact);
            const temperatura = this.getTemperature(score);

            await databaseService.updateLeadScore(phone, score, temperatura);

            logger.info(`✅ Lead ${phone} scored: ${score} (${temperatura})`);

            return { score, temperatura };
        } catch (error) {
            logger.error(`Erro ao calcular score para ${phone}:`, error);
            return null;
        }
    }

    /**
     * Calcula score para todos os leads no banco
     */
    async scoreAllLeads() {
        try {
            logger.info('🎯 Iniciando scoring de todos os leads...');

            const leads = await databaseService.db.all('SELECT phone FROM contacts');
            let scored = 0;

            for (const lead of leads) {
                const result = await this.scoreContact(lead.phone);
                if (result) scored++;
            }

            logger.info(`✅ Scoring completo! ${scored}/${leads.length} leads pontuados`);
            return { total: leads.length, scored };
        } catch (error) {
            logger.error('Erro ao pontuar todos os leads:', error);
            throw error;
        }
    }
}

module.exports = new LeadScoringService();
