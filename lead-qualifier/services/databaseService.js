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
        await this.db.run(
            `INSERT OR IGNORE INTO contacts (phone, stage, data_cache, created_at, updated_at) 
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
}

module.exports = new DatabaseService();
