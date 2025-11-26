const databaseService = require('./services/databaseService');
const fs = require('fs');

async function checkContact() {
    await databaseService.init();
    const contact = await databaseService.getContact('124451022733563@lid');

    const output = {
        contact,
        cnpj: contact?.cnpj,
        name: contact?.name,
        stage: contact?.stage,
        data_cache: contact?.data_cache
    };

    fs.writeFileSync('contact_debug.json', JSON.stringify(output, null, 2));
    console.log('Dados salvos em contact_debug.json');
    process.exit(0);
}

checkContact().catch(console.error);
