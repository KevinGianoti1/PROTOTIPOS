const databaseService = require('../services/databaseService');
const logger = require('../utils/logger');

async function checkDb() {
    try {
        await databaseService.init();

        console.log('\n=== 📂 CONSULTANDO BANCO DE DADOS ===\n');

        const contacts = await databaseService.db.all('SELECT * FROM contacts');
        console.log(`📌 Contatos encontrados: ${contacts.length}`);
        contacts.forEach(c => {
            console.log(`   - ${c.name} (${c.phone}) | Stage: ${c.stage} | Updated: ${c.updated_at}`);
        });

        console.log('\n💬 Últimas Mensagens:');
        const messages = await databaseService.db.all('SELECT * FROM messages ORDER BY created_at DESC LIMIT 5');
        messages.forEach(m => {
            console.log(`   [${m.role}] ${m.content.substring(0, 50)}...`);
        });

    } catch (error) {
        console.error('Erro:', error);
    }
}

checkDb();
