require('dotenv').config();
const rdStationService = require('../services/rdStationService');
const logger = require('../utils/logger');

// Mock logger to see output in console
logger.info = console.log;
logger.warn = console.warn;
logger.error = console.error;

async function testCollision() {
    try {
        console.log('--- INICIANDO TESTE DE COLISÃO ---');

        // 1. Buscar uma empresa existente para usar o nome
        // Vamos usar um nome que sabemos que existe ou buscar "A" para pegar qualquer uma
        const existingId = await rdStationService.searchOrganization("ABRAMAX", false);

        if (!existingId) {
            console.error('Não encontrou empresa "ABRAMAX" para teste. Abortando.');
            return;
        }

        console.log(`Empresa existente encontrada. ID: ${existingId}`);

        // Precisamos do NOME exato para causar colisão.
        // O serviço não tem método público para pegar detalhes, então vamos assumir que o nome é "ABRAMAX" 
        // ou vamos tentar criar com um nome que sabemos que vai dar 422 se o search funcionou.
        // Melhor: vamos tentar criar uma empresa com um nome fixo que vamos criar agora, e depois tentar criar de novo.

        const testName = `TESTE COLISAO ${Date.now()}`;

        console.log(`\n1. Criando empresa original: "${testName}"`);
        const empresaOriginal = {
            razaoSocial: testName,
            nomeFantasia: "Teste",
            cnpjFormatado: "00.000.000/0000-00",
            logradouro: "Rua Teste",
            numero: "123",
            bairro: "Centro",
            email: "teste@teste.com",
            ddd: "11",
            telefone: "999999999"
        };

        const newId = await rdStationService.createOrganization(empresaOriginal);
        console.log(`Empresa criada com sucesso. ID: ${newId}`);

        console.log('Aguardando 3 segundos para indexação...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log(`\n2. Tentando criar DUPLICATA (mesmo nome): "${testName}"`);
        // O serviço deve capturar o 422 e retornar o ID da empresa criada acima (newId)

        const recoveredId = await rdStationService.createOrganization(empresaOriginal);

        console.log(`\nResultado da tentativa de duplicata:`);
        console.log(`ID Original:   ${newId}`);
        console.log(`ID Recuperado: ${recoveredId}`);

        if (newId === recoveredId) {
            console.log('\n✅ SUCESSO! O sistema recuperou o ID existente em vez de falhar ou duplicar.');
            process.exit(0);
        } else {
            console.error('\n❌ FALHA! Os IDs são diferentes ou nulos.');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ ERRO NO TESTE:', error.message);
        process.exit(1);
    }
}

testCollision();
