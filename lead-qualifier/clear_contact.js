// Script para limpar dados de um contato específico
const databaseService = require('./services/databaseService');
const logger = require('./utils/logger');

// Número do contato de teste (Kevin)
const phoneNumber = '5511917801636';

async function clearContact() {
    try {
        await databaseService.init();

        console.log(`🧹 Limpando dados do contato: ${phoneNumber}`);

        await databaseService.deleteContact(phoneNumber);

        console.log('✅ Contato limpo com sucesso!');
        console.log('✅ Márcia está pronta para uma nova conversa.');

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao limpar contato:', error);
        process.exit(1);
    }
}

clearContact();
