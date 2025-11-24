require('dotenv').config();
const marciaAgentService = require('../services/marciaAgentService');
const logger = require('../utils/logger');

// Mock logger para output limpo
logger.info = console.log;
logger.warn = console.warn;
logger.error = console.error;

async function testFullConversation() {
    console.log('🧪 === TESTE COMPLETO: MÁRCIA + RD STATION ===\n');

    const testPhone = '5511999887766'; // Número de teste

    // Simula uma conversa completa
    const messages = [
        'Oi',
        '08.054.886/0001-68', // CNPJ válido com CNAE aprovado
        'Empresa Teste Márcia',
        '11 98888-7777',
        'contato@empresateste.com',
        'Revenda',
        'Instagram',
        'Discos diamantados para porcelanato',
        '100 unidades',
        'Agora',
        'Sim, tudo certo!'
    ];

    console.log('📱 Iniciando conversa simulada...\n');

    for (let i = 0; i < messages.length; i++) {
        const userMessage = messages[i];
        console.log(`\n👤 USUÁRIO: ${userMessage}`);

        try {
            const response = await marciaAgentService.processMessage(testPhone, userMessage);
            console.log(`🤖 MÁRCIA: ${response.substring(0, 200)}${response.length > 200 ? '...' : ''}`);

            // Pequena pausa entre mensagens (simula digitação)
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            console.error(`\n❌ Erro na mensagem ${i + 1}:`, error.message);
            break;
        }
    }

    console.log('\n\n✅ Teste concluído!');
    console.log('\n📊 Agora verifique no RD Station se foi criado:');
    console.log('   - Empresa: "ABRAMAX ABRASIVOS LTDA" (razão social do CNPJ)');
    console.log('   - Contato: "Empresa Teste Márcia"');
    console.log('   - Oportunidade vinculada aos dois');
    console.log('\n💡 Dica: Veja os logs acima para detalhes do processamento!');
}

testFullConversation().catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
});
