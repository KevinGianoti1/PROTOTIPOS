const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { Pool } = require('pg');
const path = require('path');
const logger = require('../utils/logger');

class DatabaseService {
    constructor() {
        this.db = null;
        this.isPostgres = !!process.env.DATABASE_URL;
        this.dbPath = path.join(__dirname, '../database.sqlite');
    }

    async init() {
        try {
            if (this.isPostgres) {
                // PostgreSQL (Produção - Render)
                this.db = new Pool({
                    connectionString: process.env.DATABASE_URL,
                    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
                });

                // Testa conexão
                await this.db.query('SELECT NOW()');
                logger.info('📊 PostgreSQL conectado com sucesso');
            } else {
                // SQLite (Desenvolvimento local)
                this.db = await open({
                    filename: this.dbPath,
                    driver: sqlite3.Database
                });
                logger.info('📦 SQLite conectado com sucesso');
            }

            await this.createTables();
            await this.migrateTables();
            logger.info('✅ Banco de dados inicializado');
        } catch (error) {
            logger.error('❌ Erro ao inicializar banco de dados:', error);
            throw error;
        }
    }

    // === Métodos de abstra ção para suportar SQLite e PostgreSQL ===

    async exec(sql) {
        if (this.isPostgres) {
            // PostgreSQL não tem exec(), usa query()
            return await this.db.query(sql);
        } else {
            return await this.db.exec(sql);
        }
    }

    async run(sql, params = []) {
        if (this.isPostgres) {
            // Converte placeholders ? para $1, $2, $3...
            const pgSql = this._convertPlaceholders(sql);
            return await this.db.query(pgSql, params);
        } else {
            return await this.db.run(sql, params);
        }
    }

    async get(sql, params = []) {
        if (this.isPostgres) {
            const pgSql = this._convertPlaceholders(sql);
            const result = await this.db.query(pgSql, params);
            return result.rows[0] || null;
        } else {
            return await this.db.get(sql, params);
        }
    }

    async all(sql, params = []) {
        if (this.isPostgres) {
            const pgSql = this._convertPlaceholders(sql);
            const result = await this.db.query(pgSql, params);
            return result.rows;
        } else {
            return await this.db.all(sql, params);
        }
    }

    // Converte placeholders ? (SQLite) para $1, $2... (PostgreSQL)
    _convertPlaceholders(sql) {
        let index = 1;
        return sql.replace(/\?/g, () => `$${index++}`);
    }

    async createTables() {
        // Sintaxe compatível com ambos os bancos
        const timestampDefault = this.isPostgres ? 'TIMESTAMP DEFAULT NOW()' : 'DATETIME DEFAULT CURRENT_TIMESTAMP';
        const autoIncrement = this.isPostgres ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';

        // Tabela de Contatos (Estado do Lead)
        await this.exec(`
            CREATE TABLE IF NOT EXISTS contacts (
                phone TEXT PRIMARY KEY,
                name TEXT,
                email TEXT,
                cnpj TEXT,
                source TEXT,
                origin TEXT,
                campaign TEXT,
                thread_id TEXT,
                stage TEXT DEFAULT 'initial',
                data_cache TEXT,
                created_at ${timestampDefault},
                updated_at ${timestampDefault}
            )
        `);

        // Tabela de Mensagens (Histórico)
        await this.exec(`
            CREATE TABLE IF NOT EXISTS messages (
                id ${autoIncrement},
                phone TEXT,
                role TEXT,
                content TEXT,
                created_at ${timestampDefault},
                FOREIGN KEY(phone) REFERENCES contacts(phone)
            )
        `);
    }

    async migrateTables() {
        try {
            const booleanDefault = this.isPostgres ? 'FALSE' : '0';
            const timestampType = this.isPostgres ? 'TIMESTAMP' : 'DATETIME';

            // Colunas existentes
            await this.exec("ALTER TABLE contacts ADD COLUMN source TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN origin TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN campaign TEXT").catch(() => { });

            // Informações da Empresa (CNPJ)
            await this.exec("ALTER TABLE contacts ADD COLUMN razao_social TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN nome_fantasia TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN cnae_principal TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN cnae_descricao TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN porte_empresa TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN capital_social REAL").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN data_abertura TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN situacao_cadastral TEXT").catch(() => { });

            // Endereço Completo
            await this.exec("ALTER TABLE contacts ADD COLUMN logradouro TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN numero TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN complemento TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN bairro TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN cidade TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN estado TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN cep TEXT").catch(() => { });

            // Dados de Contato Adicionais
            await this.exec("ALTER TABLE contacts ADD COLUMN telefone_fixo TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN site TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN linkedin TEXT").catch(() => { });

            // Informações do Lead
            await this.exec("ALTER TABLE contacts ADD COLUMN cargo_contato TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN departamento TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN produto_interesse TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN quantidade_estimada TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN prazo_compra TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN ticket_medio REAL").catch(() => { });

            // Qualificação & Scoring
            await this.exec("ALTER TABLE contacts ADD COLUMN lead_score INTEGER DEFAULT 0").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN temperatura TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN motivo_desqualificacao TEXT").catch(() => { });
            await this.exec(`ALTER TABLE contacts ADD COLUMN cnae_valido BOOLEAN`).catch(() => { });

            // Interação & Engajamento
            await this.exec("ALTER TABLE contacts ADD COLUMN total_mensagens INTEGER DEFAULT 0").catch(() => { });
            await this.exec(`ALTER TABLE contacts ADD COLUMN ultima_interacao ${timestampType}`).catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN tempo_resposta_medio INTEGER").catch(() => { });
            await this.exec(`ALTER TABLE contacts ADD COLUMN catalogo_enviado BOOLEAN DEFAULT ${booleanDefault}`).catch(() => { });
            await this.exec(`ALTER TABLE contacts ADD COLUMN audio_recebido BOOLEAN DEFAULT ${booleanDefault}`).catch(() => { });

            // Integração RD Station
            await this.exec("ALTER TABLE contacts ADD COLUMN rd_deal_id TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN rd_contact_id TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN rd_organization_id TEXT").catch(() => { });
            await this.exec(`ALTER TABLE contacts ADD COLUMN rd_synced_at ${timestampType}`).catch(() => { });

            // Anotações & Observações
            await this.exec("ALTER TABLE contacts ADD COLUMN observacoes TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN tags TEXT").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN prioridade TEXT").catch(() => { });

            // Robustez & Segurança
            await this.exec(`ALTER TABLE contacts ADD COLUMN flagged_for_moderation BOOLEAN DEFAULT ${booleanDefault}`).catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN cnpj_attempts INTEGER DEFAULT 0").catch(() => { });
            await this.exec("ALTER TABLE contacts ADD COLUMN blocked_until TEXT").catch(() => { });
            await this.exec(`ALTER TABLE contacts ADD COLUMN cnpj_confirmed BOOLEAN DEFAULT ${booleanDefault}`).catch(() => { });

            // Sistema de Sessões de Conversa
            await this.exec("ALTER TABLE contacts ADD COLUMN current_conversation_id TEXT").catch(() => { });
            await this.exec("ALTER TABLE messages ADD COLUMN conversation_id TEXT").catch(() => { });

            logger.info('✅ Migração de colunas concluída');
        } catch (error) {
            logger.error('Erro na migração:', error);
        }
    }

    // --- Métodos de Contato ---

    async getContact(phone) {
        const contact = await this.get('SELECT * FROM contacts WHERE phone = ?', [phone]);
        if (contact && contact.data_cache) {
            try {
                contact.data_cache = JSON.parse(contact.data_cache);
            } catch (e) {
                contact.data_cache = {};
            }
        }
        return contact;
    }

    async createContact(phone, initialData = {}) {
        const now = new Date().toISOString();
        const dataCache = JSON.stringify(initialData);

        if (this.isPostgres) {
            await this.run(`
                INSERT INTO contacts (phone, stage, data_cache, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (phone) DO NOTHING`,
                [phone, 'initial', dataCache, now, now]
            );
        } else {
            await this.run(`
                INSERT OR IGNORE INTO contacts (phone, stage, data_cache, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?)`,
                [phone, 'initial', dataCache, now, now]
            );
        }

        return this.getContact(phone);
    }

    async updateContact(phone, updates) {
        const fields = [];
        const values = [];

        for (const [key, value] of Object.entries(updates)) {
            if (key === 'data_cache') {
                fields.push(`${key} = ?`);
                values.push(JSON.stringify(value));
            } else {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        }

        fields.push('updated_at = ?');
        values.push(new Date().toISOString());

        values.push(phone); // Para o WHERE

        const query = `UPDATE contacts SET ${fields.join(', ')} WHERE phone = ?`;
        await this.run(query, values);
    }

    async deleteContact(phone) {
        await this.run('DELETE FROM messages WHERE phone = ?', [phone]);
        await this.run('DELETE FROM contacts WHERE phone = ?', [phone]);
    }

    // --- Métodos de Mensagem ---

    async addMessage(phone, role, content, conversationId = null) {
        await this.run(
            'INSERT INTO messages (phone, conversation_id, role, content) VALUES (?, ?, ?, ?)',
            [phone, conversationId, role, content]
        );
    }

    async getHistory(phone, conversationId = null, limit = 50) {
        if (conversationId) {
            // Filtra pela sessão atual
            return await this.all(
                'SELECT role, content FROM messages WHERE phone = ? AND conversation_id = ? ORDER BY created_at ASC LIMIT ?',
                [phone, conversationId, limit]
            );
        } else {
            // Fallback para compatibilidade (retorna tudo)
            return await this.all(
                'SELECT role, content FROM messages WHERE phone = ? ORDER BY created_at ASC LIMIT ?',
                [phone, limit]
            );
        }
    }

    // --- Helper para Filtros ---
    _buildFilterQuery(filters = {}) {
        let query = ' WHERE 1=1';
        const params = [];

        if (filters.origin) {
            query += ' AND origin = ?';
            params.push(filters.origin);
        }
        if (filters.source) {
            query += ' AND source = ?';
            params.push(filters.source);
        }
        if (filters.campaign) {
            query += ' AND campaign = ?';
            params.push(filters.campaign);
        }
        if (filters.stage) {
            query += ' AND stage = ?';
            params.push(filters.stage);
        }
        if (filters.cnae) {
            query += ' AND cnae_descricao LIKE ?';
            params.push(`%${filters.cnae}%`);
        }
        if (filters.product) {
            query += ' AND produto_interesse LIKE ?';
            params.push(`%${filters.product}%`);
        }
        if (filters.state) {
            query += ' AND estado = ?';
            params.push(filters.state);
        }
        if (filters.city) {
            query += ' AND cidade LIKE ?';
            params.push(`%${filters.city}%`);
        }

        // Date Range Filter
        if (filters.start_date) {
            query += ' AND date(created_at) >= date(?)';
            params.push(filters.start_date);
        }
        if (filters.end_date) {
            query += ' AND date(created_at) <= date(?)';
            params.push(filters.end_date);
        }

        return { query, params };
    }

    async getLeadsByFilter(filters = {}) {
        const { query: filterQuery, params } = this._buildFilterQuery(filters);
        const query = `SELECT * FROM contacts ${filterQuery} ORDER BY created_at DESC LIMIT 50`;
        return await this.all(query, params);
    }

    async getRecentLeads() {
        return await this.all('SELECT * FROM contacts ORDER BY created_at DESC LIMIT 10');
    }

    async getDailyLeads(days = 7) {
        let query;
        if (this.isPostgres) {
            query = `
                SELECT 
                    to_char(created_at, 'YYYY-MM-DD') as date,
                    COUNT(*) as count
                FROM contacts
                WHERE created_at >= NOW() - (INTERVAL '1 day' * $1)
                GROUP BY date
                ORDER BY date ASC
            `;
        } else {
            query = `
                SELECT 
                    strftime('%Y-%m-%d', created_at) as date,
                    COUNT(*) as count
                FROM contacts
                WHERE created_at >= date('now', '-' || ? || ' days')
                GROUP BY date
                ORDER BY date ASC
            `;
        }
        return await this.all(query, [days]);
    }

    async getDashboardStats(filters = {}) {
        const { query: filterQuery, params } = this._buildFilterQuery(filters);

        const total = await this.get(`SELECT COUNT(*) as count FROM contacts ${filterQuery}`, params);
        const qualified = await this.get(`SELECT COUNT(*) as count FROM contacts ${filterQuery} AND stage = 'completed'`, params);
        const disqualified = await this.get(`SELECT COUNT(*) as count FROM contacts ${filterQuery} AND stage = 'disqualified'`, params);

        const byOrigin = await this.all(`
            SELECT origin as name, COUNT(*) as count 
            FROM contacts 
            ${filterQuery} AND origin IS NOT NULL 
            GROUP BY origin
        `, params);

        const totalCount = parseInt(total.count) || 0;
        const qualifiedCount = parseInt(qualified.count) || 0;
        const conversionRate = totalCount > 0 ? ((qualifiedCount / totalCount) * 100).toFixed(1) : 0;

        return {
            total: totalCount,
            qualified: qualifiedCount,
            disqualified: parseInt(disqualified.count) || 0,
            conversionRate,
            byOrigin: byOrigin.map(o => ({ name: o.name, count: parseInt(o.count) }))
        };
    }

    async getUniqueOrigins() {
        const result = await this.all("SELECT DISTINCT origin FROM contacts WHERE origin IS NOT NULL AND origin != '' ORDER BY origin ASC");
        return result.map(r => r.origin);
    }

    async getUniqueSources() {
        const result = await this.all("SELECT DISTINCT source FROM contacts WHERE source IS NOT NULL AND source != '' ORDER BY source ASC");
        return result.map(r => r.source);
    }

    async getUniqueCampaigns() {
        const result = await this.all("SELECT DISTINCT campaign FROM contacts WHERE campaign IS NOT NULL AND campaign != '' ORDER BY campaign ASC");
        return result.map(r => r.campaign);
    }

    // --- Métodos Avançados de Analytics (Fase 1) ---

    async getAdvancedStats(filters = {}) {
        const { query: filterQuery, params } = this._buildFilterQuery(filters);

        // Estatísticas por temperatura
        const byTemperature = await this.all(`
            SELECT temperatura, COUNT(*) as count 
            FROM contacts 
            ${filterQuery} AND temperatura IS NOT NULL 
            GROUP BY temperatura
        `, params);

        // Ticket médio
        const avgTicket = await this.get(`SELECT AVG(ticket_medio) as avg FROM contacts ${filterQuery} AND ticket_medio IS NOT NULL`, params);

        // Taxa de resposta (leads que enviaram mais de 1 mensagem)
        const totalLeads = await this.get(`SELECT COUNT(*) as count FROM contacts ${filterQuery} `, params);
        const activeLeads = await this.get(`SELECT COUNT(*) as count FROM contacts ${filterQuery} AND total_mensagens > 1`, params);

        const totalCount = parseInt(totalLeads.count) || 0;
        const activeCount = parseInt(activeLeads.count) || 0;
        const responseRate = totalCount > 0 ? ((activeCount / totalCount) * 100).toFixed(1) : 0;

        // Tempo médio de qualificação (em horas)
        let avgTimeQuery;
        if (this.isPostgres) {
            avgTimeQuery = `
                SELECT AVG(
                    EXTRACT(EPOCH FROM (updated_at - created_at)) / 3600
                ) as avg_hours
                FROM contacts 
                ${filterQuery} AND stage = 'completed'
            `;
        } else {
            avgTimeQuery = `
                SELECT AVG(
                    (julianday(updated_at) - julianday(created_at)) * 24
                ) as avg_hours
                FROM contacts 
                ${filterQuery} AND stage = 'completed'
            `;
        }

        const avgQualificationTime = await this.get(avgTimeQuery, params);

        // Catálogos enviados
        const catalogsSent = await this.get(`SELECT COUNT(*) as count FROM contacts ${filterQuery} AND catalogo_enviado = 1`, params);

        return {
            byTemperature: byTemperature.map(t => ({
                name: t.temperatura || 'Não classificado',
                count: parseInt(t.count)
            })),
            avgTicket: (avgTicket && avgTicket.avg) ? parseFloat(avgTicket.avg).toFixed(2) : 0,
            responseRate: responseRate,
            avgQualificationTime: (avgQualificationTime && avgQualificationTime.avg_hours) ? parseFloat(avgQualificationTime.avg_hours).toFixed(1) : 0,
            catalogsSent: parseInt(catalogsSent.count) || 0
        };
    }

    async getLeadScoreDistribution(filters = {}) {
        const { query: filterQuery, params } = this._buildFilterQuery(filters);
        const distribution = await this.all(`
            SELECT
            CASE 
                    WHEN lead_score >= 80 THEN '80-100'
                    WHEN lead_score >= 60 THEN '60-79'
                    WHEN lead_score >= 40 THEN '40-59'
                    WHEN lead_score >= 20 THEN '20-39'
                    ELSE '0-19'
            END as range,
                COUNT(*) as count
            FROM contacts
            ${filterQuery} AND lead_score IS NOT NULL
            GROUP BY range
            ORDER BY range DESC
        `, params);
        return distribution;
    }

    async getTopCNAEs(limit = 5, filters = {}) {
        const { query: filterQuery, params } = this._buildFilterQuery(filters);
        const result = await this.all(`
            SELECT cnae_descricao, COUNT(*) as count 
            FROM contacts 
            ${filterQuery} AND cnae_descricao IS NOT NULL 
            GROUP BY cnae_descricao 
            ORDER BY count DESC
            LIMIT ?
        `, [...params, limit]);
        return result.map(r => ({ name: r.cnae_descricao, count: parseInt(r.count) }));
    }

    async getTopProducts(limit = 5, filters = {}) {
        const { query: filterQuery, params } = this._buildFilterQuery(filters);
        const result = await this.all(`
            SELECT produto_interesse, COUNT(*) as count 
            FROM contacts 
            ${filterQuery} AND produto_interesse IS NOT NULL 
            GROUP BY produto_interesse 
            ORDER BY count DESC
            LIMIT ?
        `, [...params, limit]);
        return result.map(r => ({ name: r.produto_interesse, count: parseInt(r.count) }));
    }

    async getGeographicDistribution(filters = {}) {
        const { query: filterQuery, params } = this._buildFilterQuery(filters);
        const result = await this.all(`
            SELECT estado, COUNT(*) as count 
            FROM contacts 
            ${filterQuery} AND estado IS NOT NULL 
            GROUP BY estado 
            ORDER BY count DESC 
            LIMIT 10
        `, params);
        return result.map(r => ({ name: r.estado, count: parseInt(r.count) }));
    }

    async getFunnelData(filters = {}) {
        const { query: filterQuery, params } = this._buildFilterQuery(filters);

        const initial = await this.get(`SELECT COUNT(*) as count FROM contacts ${filterQuery} AND stage = 'initial'`, params);
        const inProgress = await this.get(`SELECT COUNT(*) as count FROM contacts ${filterQuery} AND total_mensagens > 3`, params);
        const qualified = await this.get(`SELECT COUNT(*) as count FROM contacts ${filterQuery} AND stage = 'completed'`, params);

        return [
            { stage: 'Contato Inicial', count: parseInt(initial.count) || 0 },
            { stage: 'Em Conversa', count: parseInt(inProgress.count) || 0 },
            { stage: 'Qualificado', count: parseInt(qualified.count) || 0 }
        ];
    }

    async updateLeadScore(phone, score, temperatura) {
        await this.run(
            'UPDATE contacts SET lead_score = ?, temperatura = ?, updated_at = ? WHERE phone = ?',
            [score, temperatura, new Date().toISOString(), phone]
        );
    }

    // --- Métodos para Análise de Histórico Completo ---

    async getFullHistory(phone) {
        // Retorna TODAS as mensagens, agrupadas por conversation_id
        return await this.all(
            'SELECT conversation_id, role, content, created_at FROM messages WHERE phone = ? ORDER BY created_at ASC',
            [phone]
        );
    }

    async getConversations(phone) {
        // Lista todas as sessões de conversa
        return await this.all(
            'SELECT DISTINCT conversation_id, MIN(created_at) as started_at, MAX(created_at) as last_message FROM messages WHERE phone = ? GROUP BY conversation_id ORDER BY started_at DESC',
            [phone]
        );
    }

    /**
     * Retorna histórico formatado para o painel de conversas
     * @param {string} phone - Número do telefone
     * @returns {Object} Histórico com contact info e messages
     */
    async getConversationHistory(phone) {
        const contact = await this.getContact(phone);
        const messages = await this.all(
            'SELECT role, content, created_at FROM messages WHERE phone = ? ORDER BY created_at ASC',
            [phone]
        );

        return {
            contact: contact ? {
                name: contact.name,
                phone: contact.phone,
                stage: contact.stage,
                temperature: contact.temperatura,
                score: contact.lead_score
            } : null,
            messages: messages.map(m => ({
                role: m.role,
                content: m.content,
                time: new Date(m.created_at).toLocaleString('pt-BR')
            }))
        };
    }

    async clearAllContacts() {
        try {
            await this.run('DELETE FROM contacts');
            logger.info('🧹 Banco de dados limpo (tabela contacts)');
        } catch (error) {
            logger.error('Erro ao limpar contatos:', error);
            throw error;
        }
    }
}

module.exports = new DatabaseService();
