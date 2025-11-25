const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const logger = require('../utils/logger');

class KnowledgeBaseService {
    constructor() {
        this.knowledgeBaseContent = '';
        this.isLoaded = false;
        this.catalogPath = path.join(__dirname, '../knowledge_base/catalogo.pdf');
    }

    /**
     * Carrega o conteúdo da base de conhecimento (PDF)
     */
    async loadKnowledgeBase() {
        try {
            logger.info('📚 Carregando base de conhecimento...');

            if (!fs.existsSync(this.catalogPath)) {
                logger.warn('⚠️ Arquivo de catálogo não encontrado:', this.catalogPath);
                return;
            }

            const dataBuffer = fs.readFileSync(this.catalogPath);
            const data = await pdf(dataBuffer);

            // Limpeza básica do texto extraído
            this.knowledgeBaseContent = data.text
                .replace(/\n\s*\n/g, '\n') // Remove linhas em branco excessivas
                .trim();

            this.isLoaded = true;
            logger.info(`✅ Base de conhecimento carregada! Tamanho: ${this.knowledgeBaseContent.length} caracteres.`);

        } catch (error) {
            logger.error('❌ Erro ao carregar base de conhecimento:', error.message);
            logger.error('Stack trace:', error.stack);
            this.isLoaded = false;
        }
    }

    /**
     * Retorna o contexto relevante para a consulta
     * Por enquanto, retorna todo o texto (se couber) ou um aviso se for muito grande.
     * @param {string} query - A pergunta do usuário (para futuro uso em busca semântica)
     * @returns {string} Contexto para o LLM
     */
    getContext(query) {
        if (!this.isLoaded) {
            return '';
        }

        // Limite de caracteres para não estourar o contexto do LLM (aprox. 15k tokens ~ 60k chars)
        // O GPT-4o-mini tem contexto grande, mas é bom limitar por segurança e custo.
        const MAX_CONTEXT_LENGTH = 50000;

        if (this.knowledgeBaseContent.length > MAX_CONTEXT_LENGTH) {
            // Se for muito grande, por enquanto vamos pegar os primeiros X caracteres.
            // TODO: Implementar busca semântica ou chunking mais inteligente.
            logger.warn('⚠️ Base de conhecimento muito grande, truncando...');
            return this.knowledgeBaseContent.substring(0, MAX_CONTEXT_LENGTH) + '\n...(conteúdo truncado)...';
        }

        return this.knowledgeBaseContent;
    }

    /**
     * Retorna o caminho do arquivo de catálogo
     */
    getCatalogPath() {
        return this.catalogPath;
    }
}

module.exports = new KnowledgeBaseService();
