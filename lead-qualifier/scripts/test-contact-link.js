require('dotenv').config();
const axios = require('axios');

// IDs do último teste
const dealId = '6924b1c604382b0013d37bee'; // Do último teste
const contactId = '6924b1c5e5fc4400154cc4a5'; // Precisa ser atualizado

const API_URL = 'https://crm.rdstation.com/api/v1';
const token = process.env.RD_STATION_API_TOKEN;

async function testContactLinking() {
    console.log('🧪 Testando vinculação de contato...\n');

    try {
        // Tenta vincular usando POST /deals/{id}/contacts
        console.log(`Tentando vincular contato ${contactId} ao deal ${dealId}...`);

        const response = await axios.post(
            `${API_URL}/deals/${dealId}/contacts?token=${token}`,
            {
                contact_id: contactId
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('✅ Sucesso!', response.data);

    } catch (error) {
        console.error('❌ Erro:', error.response?.data || error.message);
        console.log('\nDetalhes do erro:');
        console.log('Status:', error.response?.status);
        console.log('Data:', JSON.stringify(error.response?.data, null, 2));
    }
}

testContactLinking();
