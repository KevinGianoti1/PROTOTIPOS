const databaseService = require('./services/databaseService');
const marciaAgentService = require('./services/marciaAgentService');
const logger = require('./utils/logger');

const fs = require('fs');
const util = require('util');

const logFile = fs.createWriteStream('test_results.log', { flags: 'w' });
const logStdout = process.stdout;

console.log = function (d) { //
    logFile.write(util.format(d) + '\n');
    logStdout.write(util.format(d) + '\n');
};

logger.info = console.log;
logger.error = console.log;
logger.warn = console.log;

async function runTests() {
    console.log('🚀 INICIANDO TESTES AUTOMATIZADOS DE SESSÃO...\n');

    const testPhone = '5511999998888'; // Número de teste

    try {
        // 1. Limpar dados anteriores
        console.log('🧹 Limpando dados de teste...');
        await databaseService.deleteContact(testPhone);

        // 2. Simular Primeira Conversa (Sessão 1)
        console.log('\n--- 🧪 CENÁRIO 1: Primeira Conversa ---');

        // Mensagem inicial
        console.log('👤 User: Olá, gostaria de saber mais');
        let response = await marciaAgentService.processMessage(testPhone, 'Olá, gostaria de saber mais');
        console.log('🤖 Márcia:', response);

        // Verificar criação da sessão
        let contact = await databaseService.getContact(testPhone);
        const session1 = contact.current_conversation_id;
        console.log(`✅ Sessão 1 criada: ${session1}`);

        if (!session1) throw new Error('Falha: conversation_id não criado!');

        // Simular fornecimento de nome
        console.log('👤 User: Meu nome é Teste da Silva');
        await marciaAgentService.processMessage(testPhone, 'Meu nome é Teste da Silva');

        // Simular fornecimento de origem
        console.log('👤 User: Vi no Instagram');
        await marciaAgentService.processMessage(testPhone, 'Vi no Instagram');

        // Verificar dados salvos
        contact = await databaseService.getContact(testPhone);
        console.log(`📊 Dados coletados: Nome=${contact.name}, Origem=${contact.origin}`);

        if (contact.origin !== 'Instagram') console.warn('⚠️ Origem não capturada como Instagram (pode depender da IA)');

        // 3. Simular Timeout (Avançar tempo)
        console.log('\n--- ⏳ CENÁRIO 2: Simulação de Timeout (25h depois) ---');

        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 25);

        await databaseService.db.run(
            'UPDATE contacts SET ultima_interacao = ? WHERE phone = ?',
            [yesterday.toISOString(), testPhone]
        );
        console.log('✅ Tempo avançado em 25 horas no banco de dados');

        // 4. Simular Retorno (Sessão 2)
        console.log('\n--- 🧪 CENÁRIO 3: Retorno do Cliente ---');

        console.log('👤 User: Oi, voltei');
        response = await marciaAgentService.processMessage(testPhone, 'Oi, voltei');
        console.log('🤖 Márcia:', response);

        // Verificar Nova Sessão
        contact = await databaseService.getContact(testPhone);
        const session2 = contact.current_conversation_id;
        console.log(`✅ Sessão 2 criada: ${session2}`);

        // Validações Críticas
        if (session1 === session2) throw new Error('❌ ERRO: Sessão não foi renovada!');
        if (contact.name !== 'Teste da Silva') throw new Error('❌ ERRO: Nome não foi preservado!');
        if (contact.origin !== null) throw new Error(`❌ ERRO: Origem não foi limpa! Valor atual: ${contact.origin}`);

        console.log('✅ SUCESSO: Nova sessão criada, nome preservado, dados limpos.');

        // 5. Verificar Isolamento de Histórico
        console.log('\n--- 🔍 CENÁRIO 4: Verificação de Histórico ---');

        // Histórico que a Márcia vê (apenas sessão atual)
        const activeHistory = await databaseService.getHistory(testPhone, session2);
        console.log(`📝 Histórico Ativo (Sessão 2): ${activeHistory.length} mensagens`);

        // Histórico completo (banco)
        const fullHistory = await databaseService.getFullHistory(testPhone);
        console.log(`📚 Histórico Completo (Total): ${fullHistory.length} mensagens`);

        if (activeHistory.length >= fullHistory.length) throw new Error('❌ ERRO: Isolamento de histórico falhou!');

        // Verificar conteúdo do histórico ativo (não deve ter "Instagram")
        const hasOldData = activeHistory.some(m => m.content.includes('Instagram'));
        if (hasOldData) throw new Error('❌ ERRO: Dados da sessão antiga vazaram para a nova!');

        console.log('✅ SUCESSO: Histórico perfeitamente isolado.');

        console.log('\n🎉 TODOS OS TESTES PASSARAM! O SISTEMA ESTÁ ROBUSTO. 🎉');

    } catch (error) {
        console.error('\n❌ FALHA NOS TESTES:', error.message);
        console.error(error);
    }
}

// Executar
runTests();
