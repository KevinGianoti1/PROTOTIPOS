const databaseService = require('./services/databaseService');

async function checkHistory() {
    await databaseService.init();
    // Vou pegar o número que apareceu nos logs (ou tentar descobrir qual é)
    // O log mostrou algo como 124451022733563@lid... vou tentar buscar todos e listar

    const db = databaseService.db;
    const messages = await db.all('SELECT phone, role, content, created_at FROM messages ORDER BY created_at DESC LIMIT 10');

    console.log('🔍 Últimas 10 mensagens no banco:');
    messages.forEach(msg => {
        console.log(`[${msg.created_at}] ${msg.phone} (${msg.role}): ${msg.content.substring(0, 100)}...`);
    });
}

checkHistory();
