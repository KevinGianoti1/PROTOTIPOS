require('dotenv').config();
const axios = require('axios');

const TOKEN = process.env.RD_STATION_API_TOKEN;
const API_URL = 'https://crm.rdstation.com/api/v1';

async function debug() {
    try {
        console.log('1. Buscando/Criando Organização...');
        // Vamos usar uma org que sabemos que existe ou criar
        const orgPayload = {
            organization: {
                name: "Debug Org " + Date.now(),
                resume: "Debug"
            }
        };
        const orgRes = await axios.post(`${API_URL}/organizations?token=${TOKEN}`, orgPayload);
        const orgId = orgRes.data.id;
        console.log('Organization ID:', orgId);

        console.log('2. Criando Contato...');
        const contactPayload = {
            contact: {
                name: "Debug Contact " + Date.now(),
                phones: [{ phone: "(11) 99999-9999" }]
            }
        };
        const contactRes = await axios.post(`${API_URL}/contacts?token=${TOKEN}`, contactPayload);
        const contactId = contactRes.data.id;
        console.log('Contact ID:', contactId);

        console.log('3. Tentando criar Deal com Vínculos...');
        const dealPayload = {
            deal: {
                name: "Debug Deal " + Date.now(),
                deal_pipeline_id: '63d81825906fa10010e05051',
                deal_stage_id: '6478a01a95b902000dc981ec',
                user_id: '63d3f64aa6528000185e5ddd',
                organization_id: orgId,
                deal_contacts: [
                    { contact_id: contactId }
                ],
                deal_custom_fields: [
                    {
                        custom_field_id: '67a4c29d9207d10020ee88cb',
                        value: 'true'
                    }
                ]
            }
        };

        console.log('Payload:', JSON.stringify(dealPayload, null, 2));

        const dealRes = await axios.post(`${API_URL}/deals?token=${TOKEN}`, dealPayload);
        console.log('SUCESSO! Deal ID:', dealRes.data.id);

    } catch (error) {
        console.error('ERRO:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

debug();
