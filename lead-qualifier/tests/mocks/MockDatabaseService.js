const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const logger = require('../../utils/logger');

class MockDatabaseService {
    constructor() {
        this.db = null;
        this.messages = []; // In-memory message store for easy verification
    }

    async init() {
        try {
            this.db = await open({
                filename: ':memory:',
                driver: sqlite3.Database
            });

            await this.createTables();
            logger.info('📦 Mock Database initialized (in-memory)');
        } catch (error) {
            logger.error('❌ Error initializing Mock Database:', error);
            throw error;
        }
    }

    async createTables() {
        // Simplified schema for testing
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS contacts (
                phone TEXT PRIMARY KEY,
                name TEXT,
                email TEXT,
                cnpj TEXT,
                source TEXT,
                origin TEXT,
                campaign TEXT,
                stage TEXT DEFAULT 'initial',
                data_cache TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                cnpj_attempts INTEGER DEFAULT 0,
                blocked_until TEXT,
                flagged_for_moderation BOOLEAN DEFAULT 0,
                catalogo_enviado BOOLEAN DEFAULT 0,
                audio_recebido BOOLEAN DEFAULT 0,
                total_mensagens INTEGER DEFAULT 0,
                -- Campos adicionais usados pelo MarciaAgentService
                produto_interesse TEXT,
                quantidade_estimada TEXT,
                prazo_compra TEXT,
                lead_score INTEGER DEFAULT 0,
                temperatura TEXT,
                motivo_desqualificacao TEXT,
                cnae_valido BOOLEAN,
                cnae_principal TEXT,
                cnae_descricao TEXT,
                porte_empresa TEXT,
                capital_social REAL,
                data_abertura TEXT,
                situacao_cadastral TEXT,
                logradouro TEXT,
                numero TEXT,
                complemento TEXT,
                bairro TEXT,
                cidade TEXT,
                estado TEXT,
                cep TEXT,
                razao_social TEXT,
                nome_fantasia TEXT,
                cnpj_confirmed BOOLEAN DEFAULT 0,
                -- Mais campos faltantes
                telefone_fixo TEXT,
                site TEXT,
                linkedin TEXT,
                cargo_contato TEXT,
                departamento TEXT,
                ticket_medio REAL,
                ultima_interacao DATETIME,
                tempo_resposta_medio INTEGER,
                rd_deal_id TEXT,
                rd_contact_id TEXT,
                rd_organization_id TEXT,
                rd_synced_at DATETIME,
                observacoes TEXT,
                tags TEXT,
                prioridade TEXT
            )
        `);

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT,
                role TEXT,
                content TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

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
        values.push(phone);

        const query = `UPDATE contacts SET ${fields.join(', ')} WHERE phone = ?`;
        await this.db.run(query, values);
    }

    async addMessage(phone, role, content) {
        await this.db.run(
            'INSERT INTO messages (phone, role, content) VALUES (?, ?, ?)',
            [phone, role, content]
        );
        this.messages.push({ phone, role, content, timestamp: new Date() });
    }

    async getHistory(phone, limit = 50) {
        return await this.db.all(
            'SELECT role, content FROM messages WHERE phone = ? ORDER BY created_at ASC LIMIT ?',
            [phone, limit]
        );
    }
}

module.exports = MockDatabaseService;
