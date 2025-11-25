const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const logger = require('../utils/logger');

class DatabaseService {
    constructor() {
        this.db = null;
        this.dbPath = path.join(__dirname, '../database.sqlite');
    }

    async init() {
        try {
            this.db = await open({
                filename: this.dbPath,
                driver: sqlite3.Database
            });

            await this.createTables();
            await this.migrateTables(); // Adiciona colunas novas se não existirem
            logger.info('📦 Banco de dados SQLite inicializado com sucesso');
        } catch (error) {
            logger.error('❌ Erro ao inicializar banco de dados:', error);
            throw error;
        }
    }

    async createTables() {
        // Tabela de Contatos (Estado do Lead)
        await this.db.exec(`
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
                data_cache TEXT, -- JSON string para guardar dados temporários
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Tabela de Mensagens (Histórico)
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT,
                role TEXT, -- 'user' ou 'assistant'
                content TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(phone) REFERENCES contacts(phone)
            )
        `);
    }

    async migrateTables() {
        try {
            // Colunas existentes
            await this.db.exec("ALTER TABLE contacts ADD COLUMN source TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN origin TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN campaign TEXT").catch(() => { });

            // Informações da Empresa (CNPJ)
            await this.db.exec("ALTER TABLE contacts ADD COLUMN razao_social TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN nome_fantasia TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN cnae_principal TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN cnae_descricao TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN porte_empresa TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN capital_social REAL").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN data_abertura TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN situacao_cadastral TEXT").catch(() => { });

            // Endereço Completo
            await this.db.exec("ALTER TABLE contacts ADD COLUMN logradouro TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN numero TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN complemento TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN bairro TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN cidade TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN estado TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN cep TEXT").catch(() => { });

            // Dados de Contato Adicionais
            await this.db.exec("ALTER TABLE contacts ADD COLUMN telefone_fixo TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN site TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN linkedin TEXT").catch(() => { });

            // Informações do Lead
            await this.db.exec("ALTER TABLE contacts ADD COLUMN cargo_contato TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN departamento TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN produto_interesse TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN quantidade_estimada TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN prazo_compra TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN ticket_medio REAL").catch(() => { });

            // Qualificação & Scoring
            await this.db.exec("ALTER TABLE contacts ADD COLUMN lead_score INTEGER DEFAULT 0").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN temperatura TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN motivo_desqualificacao TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN cnae_valido BOOLEAN").catch(() => { });

            // Interação & Engajamento
            await this.db.exec("ALTER TABLE contacts ADD COLUMN total_mensagens INTEGER DEFAULT 0").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN ultima_interacao DATETIME").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN tempo_resposta_medio INTEGER").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN catalogo_enviado BOOLEAN DEFAULT 0").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN audio_recebido BOOLEAN DEFAULT 0").catch(() => { });

            // Integração RD Station
            await this.db.exec("ALTER TABLE contacts ADD COLUMN rd_deal_id TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN rd_contact_id TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN rd_organization_id TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN rd_synced_at DATETIME").catch(() => { });

            // Anotações & Observações
            await this.db.exec("ALTER TABLE contacts ADD COLUMN observacoes TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN tags TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN prioridade TEXT").catch(() => { });

            logger.info('✅ Migração de colunas concluída');
        } catch (error) {
            logger.error('Erro na migração:', error);
        }
    }

    // --- Métodos de Contato ---

    async getContact(phone) {
        const contact = await this.db.get('SELECT * FROM contacts WHERE phone = ?', phone);
        if (contact && contact.data_cache) {
            contact.data_cache = JSON.parse(contact.data_cache);
        }
        return contact;
    }

    async createContact(phone, initialData = {}) {
        const now = new Date().toISOString();
        await this.db.run(`
            INSERT OR IGNORE INTO contacts (phone, stage, data_cache, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?)`,
            [phone, 'initial', JSON.stringify(initialData), now, now]
        );
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
        await this.db.run(query, values);
    }

    async deleteContact(phone) {
        await this.db.run('DELETE FROM messages WHERE phone = ?', phone);
        await this.db.run('DELETE FROM contacts WHERE phone = ?', phone);
    }

    // --- Métodos de Mensagem ---

    async addMessage(phone, role, content) {
        await this.db.run(
            'INSERT INTO messages (phone, role, content) VALUES (?, ?, ?)',
            [phone, role, content]
        );
    }

    async getHistory(phone, limit = 50) {
        return await this.db.all(
            'SELECT role, content FROM messages WHERE phone = ? ORDER BY created_at ASC LIMIT ?',
            [phone, limit]
        );
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

    // --- Métodos de Analytics (Dashboard) ---

    async getDashboardStats(filters = {}) {
        const { query: filterQuery, params } = this._buildFilterQuery(filters);

        const total = await this.db.get(`SELECT COUNT(*) as count FROM contacts${filterQuery}`, params);

        // For specific status counts, we need to append to the filter query
        // Note: This assumes filterQuery starts with " WHERE 1=1"
        const qualifiedQuery = `SELECT COUNT(*) as count FROM contacts${filterQuery} AND stage = 'completed'`;
        const qualified = await this.db.get(qualifiedQuery, params);

        const disqualifiedQuery = `SELECT COUNT(*) as count FROM contacts${filterQuery} AND stage = 'disqualified'`;
        const disqualified = await this.db.get(disqualifiedQuery, params);

        // Agrupamento por Origem (respeitando outros filtros)
        const byOrigin = await this.db.all(`SELECT origin, COUNT(*) as count FROM contacts${filterQuery} GROUP BY origin`, params);

        const totalCount = total.count || 0;
        const qualifiedCount = qualified.count || 0;
        const conversionRate = totalCount > 0 ? ((qualifiedCount / totalCount) * 100).toFixed(1) : 0;

        return {
            total: totalCount,
            qualified: qualifiedCount,
            disqualified: disqualified.count || 0,
            conversionRate: conversionRate,
            byOrigin: byOrigin.map(o => ({ name: o.origin || 'Desconhecido', count: o.count }))
        };
    }

    async getDailyLeads(days = 7) {
        const query = `
            SELECT 
                strftime('%Y-%m-%d', created_at) as date,
                COUNT(*) as count
            FROM contacts
            WHERE created_at >= date('now', '-' || ? || ' days')
            GROUP BY date
            ORDER BY date ASC
        `;
        return await this.db.all(query, [days]);
    }

    async getRecentLeads(limit = 10) {
        return await this.db.all(`
            SELECT 
                name, 
                razao_social,
                phone, 
                cidade,
                estado,
                cnae_descricao,
                lead_score,
                temperatura,
                stage, 
                origin, 
                campaign, 
                source, 
                created_at 
            FROM contacts 
            ORDER BY created_at DESC 
            LIMIT ?
        `, [limit]);
    }

    async getLeadsByFilter(filters = {}) {
        let query = `SELECT 
            name, 
            razao_social,
            phone, 
            cidade,
            estado,
            cnae_descricao,
            lead_score,
            temperatura,
            stage, 
            origin, 
            campaign, 
            source, 
            created_at 
        FROM contacts WHERE 1=1`;
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

        query += ' ORDER BY created_at DESC LIMIT 50';

        return await this.db.all(query, params);
    }

    async getUniqueOrigins() {
        const result = await this.db.all('SELECT DISTINCT origin FROM contacts WHERE origin IS NOT NULL AND origin != "" ORDER BY origin ASC');
        return result.map(r => r.origin);
    }

    async getUniqueSources() {
        const result = await this.db.all('SELECT DISTINCT source FROM contacts WHERE source IS NOT NULL AND source != "" ORDER BY source ASC');
        return result.map(r => r.source);
    }

    // --- Métodos Avançados de Analytics (Fase 1) ---

    async getAdvancedStats(filters = {}) {
        const { query: filterQuery, params } = this._buildFilterQuery(filters);

        // Estatísticas por temperatura
        const byTemperature = await this.db.all(`
            SELECT temperatura, COUNT(*) as count 
            FROM contacts 
            ${filterQuery} AND temperatura IS NOT NULL 
            GROUP BY temperatura
        `, params);

        // Ticket médio
        const avgTicket = await this.db.get(`SELECT AVG(ticket_medio) as avg FROM contacts ${filterQuery} AND ticket_medio IS NOT NULL`, params);

        // Taxa de resposta (leads que enviaram mais de 1 mensagem)
        const totalLeads = await this.db.get(`SELECT COUNT(*) as count FROM contacts ${filterQuery}`, params);
        const activeLeads = await this.db.get(`SELECT COUNT(*) as count FROM contacts ${filterQuery} AND total_mensagens > 1`, params);
        const responseRate = totalLeads.count > 0 ? ((activeLeads.count / totalLeads.count) * 100).toFixed(1) : 0;

        // Tempo médio de qualificação (em horas)
        const avgQualificationTime = await this.db.get(`
            SELECT AVG(
                (julianday(updated_at) - julianday(created_at)) * 24
            ) as avg_hours
            FROM contacts 
            ${filterQuery} AND stage = 'completed'
        `, params);

        // Catálogos enviados
        const catalogsSent = await this.db.get(`SELECT COUNT(*) as count FROM contacts ${filterQuery} AND catalogo_enviado = 1`, params);

        return {
            byTemperature: byTemperature.map(t => ({
                name: t.temperatura || 'Não classificado',
                count: t.count
            })),
            avgTicket: avgTicket.avg ? parseFloat(avgTicket.avg).toFixed(2) : 0,
            responseRate: responseRate,
            avgQualificationTime: avgQualificationTime.avg_hours ? parseFloat(avgQualificationTime.avg_hours).toFixed(1) : 0,
            catalogsSent: catalogsSent.count || 0
        };
    }

    async getLeadScoreDistribution(filters = {}) {
        const { query: filterQuery, params } = this._buildFilterQuery(filters);
        const distribution = await this.db.all(`
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
        const result = await this.db.all(`
            SELECT cnae_descricao, COUNT(*) as count 
            FROM contacts 
            ${filterQuery} AND cnae_descricao IS NOT NULL 
            GROUP BY cnae_descricao 
            ORDER BY count DESC 
            LIMIT ?
        `, [...params, limit]);
        return result.map(r => ({ name: r.cnae_descricao, count: r.count }));
    }

    async getTopProducts(limit = 5, filters = {}) {
        const { query: filterQuery, params } = this._buildFilterQuery(filters);
        const result = await this.db.all(`
            SELECT produto_interesse, COUNT(*) as count 
            FROM contacts 
            ${filterQuery} AND produto_interesse IS NOT NULL 
            GROUP BY produto_interesse 
            ORDER BY count DESC 
            LIMIT ?
        `, [...params, limit]);
        return result.map(r => ({ name: r.produto_interesse, count: r.count }));
    }

    async getGeographicDistribution(filters = {}) {
        const { query: filterQuery, params } = this._buildFilterQuery(filters);
        const result = await this.db.all(`
            SELECT estado, COUNT(*) as count 
            FROM contacts 
            ${filterQuery} AND estado IS NOT NULL 
            GROUP BY estado 
            ORDER BY count DESC 
            LIMIT 10
        `, params);
        return result.map(r => ({ name: r.estado, count: r.count }));
    }

    async getFunnelData(filters = {}) {
        const { query: filterQuery, params } = this._buildFilterQuery(filters);

        const initial = await this.db.get(`SELECT COUNT(*) as count FROM contacts ${filterQuery} AND stage = 'initial'`, params);
        const inProgress = await this.db.get(`SELECT COUNT(*) as count FROM contacts ${filterQuery} AND total_mensagens > 3`, params);
        const qualified = await this.db.get(`SELECT COUNT(*) as count FROM contacts ${filterQuery} AND stage = 'completed'`, params);

        return [
            { stage: 'Contato Inicial', count: initial.count || 0 },
            { stage: 'Em Conversa', count: inProgress.count || 0 },
            { stage: 'Qualificado', count: qualified.count || 0 }
        ];
    }

    async updateLeadScore(phone, score, temperatura) {
        await this.db.run(
            'UPDATE contacts SET lead_score = ?, temperatura = ?, updated_at = ? WHERE phone = ?',
            [score, temperatura, new Date().toISOString(), phone]
        );
    }
    async clearAllContacts() {
        try {
            await this.db.run('DELETE FROM contacts');
            logger.info('🧹 Banco de dados limpo (tabela contacts)');
        } catch (error) {
            logger.error('Erro ao limpar contatos:', error);
            throw error;
        }
    }
}

module.exports = new DatabaseService();
