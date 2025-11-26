const databaseService = require('./services/databaseService');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function resetDatabase() {
    try {
        const db = await open({
            filename: './database.sqlite',
            driver: sqlite3.Database
        });

        console.log('🗑️ Limpando banco de dados...');

        // Limpa tabelas
        await db.run('DELETE FROM messages');
        await db.run('DELETE FROM contacts');

        // Opcional: Resetar sequências do autoincrement se houver
        await db.run('DELETE FROM sqlite_sequence WHERE name="messages"');
        await db.run('DELETE FROM sqlite_sequence WHERE name="contacts"');

        console.log('✅ Banco de dados limpo com sucesso!');
        console.log('Tabelas "contacts" e "messages" estão vazias.');

    } catch (error) {
        console.error('❌ Erro ao limpar banco de dados:', error);
    }
}

resetDatabase();
