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
            // Tenta adicionar colunas novas em bancos existentes
            await this.db.exec("ALTER TABLE contacts ADD COLUMN source TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN origin TEXT").catch(() => { });
            await this.db.exec("ALTER TABLE contacts ADD COLUMN campaign TEXT").catch(() => { });
        } catch (error) {
            // Ignora erro se coluna já existir
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

    // --- Métodos de Analytics (Dashboard) ---

    async getDashboardStats() {
        const total = await this.db.get('SELECT COUNT(*) as count FROM contacts');
        const qualified = await this.db.get("SELECT COUNT(*) as count FROM contacts WHERE stage = 'completed'");
        const disqualified = await this.db.get("SELECT COUNT(*) as count FROM contacts WHERE stage = 'disqualified'");

        // Agrupamento por Origem
        const byOrigin = await this.db.all('SELECT origin, COUNT(*) as count FROM contacts GROUP BY origin');

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
            SELECT name, phone, stage, origin, campaign, source, created_at 
            FROM contacts 
            ORDER BY created_at DESC 
            LIMIT ?
        `, [limit]);
    }

    async getLeadsByFilter(filters = {}) {
        let query = 'SELECT name, phone, stage, origin, campaign, source, created_at FROM contacts WHERE 1=1';
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
            query += ' AND campaign LIKE ?';
            params.push(`%${filters.campaign}%`);
        }

        if (filters.stage) {
            query += ' AND stage = ?';
            params.push(filters.stage);
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
}

module.exports = new DatabaseService();
