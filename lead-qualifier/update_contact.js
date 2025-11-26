const databaseService = require('./services/databaseService');

async function updateContact() {
    await databaseService.init();

    // Atualiza o contato com os dados corretos
    await databaseService.updateContact('124451022733563@lid', {
        cnpj: '08054886000168',
        name: 'ABRAMAX',
        email: null,
        origin: 'Instagram',
        produto_interesse: 'Discos e lixas para granito',
        prazo_compra: 'O mais rápido possível'
    });

    console.log('✅ Contato atualizado com sucesso!');
    process.exit(0);
}

updateContact().catch(console.error);
