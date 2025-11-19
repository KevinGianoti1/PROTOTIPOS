require('dotenv').config();
const axios = require('axios');

const TOKEN = process.env.RD_STATION_API_TOKEN;
const API_URL = 'https://crm.rdstation.com/api/v1';

async function debug() {
    try {
        console.log('1. Buscando/Criando Organização...');
        const orgPayload = { organization: { name: "Debug PUT Org " + Date.now() } };
        const orgRes = await axios.post(`${API_URL}/organizations?token=${TOKEN}`, orgPayload);
        const orgId = orgRes.data.id;
        console.log('Organization ID:', orgId);

        console.log('2. Criando Contato...');
        const contactPayload = { contact: { name: "Debug PUT Contact " + Date.now() } };
        const contactRes = await axios.post(`${API_URL}/contacts?token=${TOKEN}`, contactPayload);
        const contactId = contactRes.data.id;
        console.log('Contact ID:', contactId);

        console.log('3. Criando Deal (Sem links)...');
        const dealPayload = {
            deal: {
                name: "Debug Deal PUT " + Date.now(),
                deal_pipeline_id: '63d81825906fa10010e05051',
                deal_stage_id: '6478a01a95b902000dc981ec',
                user_id: '63d3f64aa6528000185e5ddd'
            }
        };
        const dealRes = await axios.post(`${API_URL}/deals?token=${TOKEN}`, dealPayload);
        const dealId = dealRes.data.id;
        console.log('Deal ID:', dealId);

        console.log('4. Atualizando Deal com Vínculos (PUT)...');
        const updatePayload = {
            deal: {
                organization_id: orgId,
                deal_contacts: [
                    { contact_id: contactId }
                ]
            }
        };
        console.log('Payload PUT:', JSON.stringify(updatePayload, null, 2));

        await axios.put(`${API_URL}/deals/${dealId}?token=${TOKEN}`, updatePayload);
        console.log('SUCESSO! Deal atualizado.');

    } catch (error) {
        console.error('ERRO:', error.message);
        if (error.response) {
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

debug();
