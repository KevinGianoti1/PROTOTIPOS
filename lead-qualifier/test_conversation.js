const marciaService = require('./services/marciaAgentService');
const databaseService = require('./services/databaseService');

async function testConversation() {
    try {
        await databaseService.init();

        const phoneNumber = '124451022733563';

        console.log('1. Testando primeira mensagem...');
        let response = await marciaService.processMessage(phoneNumber, 'Oii');
        console.log('Resposta:', response);

        console.log('\n2. Testando segunda mensagem...');
        response = await marciaService.processMessage(phoneNumber, 'vi o anuncio do vocês no instagram da serra de concreto queria saber o valor');
        console.log('Resposta:', response);

        console.log('\n3. Testando terceira mensagem...');
        response = await marciaService.processMessage(phoneNumber, 'Abramax - CNPJ: 08.054.886/0001-68');
        console.log('Resposta:', response);

        console.log('\n✅ Teste concluído com sucesso!');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Erro no teste:', error);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

testConversation();
