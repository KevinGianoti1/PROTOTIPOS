/**
 * Script para processar manualmente um lead que já tem dados coletados
 * Uso: node process_lead_manual.js <phone_number>
 */

const marciaService = require('./services/marciaAgentService');
const databaseService = require('./services/databaseService');
const logger = require('./utils/logger');

async function processLeadManually(phoneNumber) {
    try {
        await databaseService.init();

        // Busca o contato
        const contact = await databaseService.getContact(phoneNumber);
        if (!contact) {
            console.error('❌ Contato não encontrado:', phoneNumber);
            process.exit(1);
        }

        console.log('📋 Dados do contato:');
        console.log('  CNPJ:', contact.cnpj);
        console.log('  Nome:', contact.name);
        console.log('  Telefone:', phoneNumber);
        console.log('  Data cache:', JSON.stringify(contact.data_cache, null, 2));

        // Prepara dados para processamento
        const data = {
            cnpj: contact.cnpj || contact.data_cache?.cnpj,
            name: contact.name || contact.data_cache?.name,
            phone: phoneNumber,
            email: contact.email || contact.data_cache?.email,
            origin: contact.origin || contact.data_cache?.origin,
            product: contact.produto_interesse || contact.data_cache?.product,
            prazo: contact.prazo_compra || contact.data_cache?.prazo
        };

        // Remove asteriscos se houver
        Object.keys(data).forEach(key => {
            if (typeof data[key] === 'string') {
                data[key] = data[key].replace(/\*\*/g, '').trim();
            }
        });

        console.log('\n🔄 Processando lead com dados:');
        console.log(JSON.stringify(data, null, 2));

        if (!data.cnpj || !data.name) {
            console.error('\n❌ Dados insuficientes! CNPJ e Nome são obrigatórios.');
            console.log('Por favor, atualize o contato no banco de dados primeiro.');
            process.exit(1);
        }

        // Processa o lead
        await marciaService.processCompleteLead(phoneNumber, data);

        console.log('\n✅ Lead processado com sucesso!');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Erro ao processar lead:', error);
        process.exit(1);
    }
}

// Pega o número do telefone dos argumentos
const phoneNumber = process.argv[2];
if (!phoneNumber) {
    console.error('Uso: node process_lead_manual.js <phone_number>');
    console.error('Exemplo: node process_lead_manual.js 124451022733563@lid');
    process.exit(1);
}

processLeadManually(phoneNumber);
