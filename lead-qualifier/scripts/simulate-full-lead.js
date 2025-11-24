require('dotenv').config();
const rdStationService = require('../services/rdStationService');
const logger = require('../utils/logger');

// Mock logger
logger.info = console.log;
logger.warn = console.warn;
logger.error = console.error;

async function simulateLead() {
    console.log('--- SIMULANDO PROCESSAMENTO DE LEAD ---');

    // Dados mockados de um lead que seria gerado pelo enriquecimento
    // Usando um CNPJ real para ter dados consistentes, mas com nome alterado para teste
    const leadData = {
        lead: {
            nome: "Teste Completo " + Date.now(),
            telefone: "(11) 97777-7777",
            email: "teste.completo@exemplo.com",
            origem: "Site"
        },
        empresa: {
            razaoSocial: "EMPRESA TESTE INTEGRACAO " + Date.now(), // Nome único para criar
            nomeFantasia: "Fantasia Teste",
            cnpjFormatado: "12.345.678/0001-90",
            logradouro: "Av Paulista",
            numero: "1000",
            bairro: "Bela Vista",
            municipio: "São Paulo",
            uf: "SP",
            cep: "01310-100",
            email: "contato@empresa.com",
            ddd: "11",
            telefone: "3333-3333",
            porte: "ME",
            naturezaJuridica: "Sociedade Empresária Limitada",
            capitalSocial: 10000,
            cnaePrincipal: { codigo: "6201-5/00", descricao: "Desenvolvimento de programas de computador sob encomenda" },
            cnaesSecundarios: []
        },
        validacao: {
            qualificado: true,
            motivo: "CNAE Principal no PCI",
            cnaeMatch: { codigo: "6201-5/00", descricao: "Desenvolvimento de programas de computador sob encomenda" }
        }
    };

    try {
        console.log(`\n1. Processando Lead para empresa: "${leadData.empresa.razaoSocial}"`);
        const result1 = await rdStationService.processLead(leadData);
        console.log('Resultado 1:', result1);

        console.log('\n--------------------------------------------------');
        console.log('Aguardando 3 segundos para simular segunda entrada...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log(`\n2. Reprocessando MESMA empresa (deve vincular à existente): "${leadData.empresa.razaoSocial}"`);
        // Mantém a mesma razão social para forçar colisão/recuperação
        const result2 = await rdStationService.processLead(leadData);
        console.log('Resultado 2:', result2);

        if (result1.success && result2.success) {
            console.log('\n✅ Teste concluído com sucesso!');
        } else {
            console.error('\n❌ Falha no processamento.');
            process.exit(1);
        }

    } catch (error) {
        console.error('\n❌ Erro fatal:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

simulateLead();
