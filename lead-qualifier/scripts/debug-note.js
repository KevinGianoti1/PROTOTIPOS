require('dotenv').config();
const axios = require('axios');

const API_URL = 'https://crm.rdstation.com/api/v1';
const TOKEN = process.env.RD_STATION_API_TOKEN;
// Usando um ID de deal recente para teste
const DEAL_ID = '691e1ac576ee100020e63aae';
const USER_ID = '63d3f64aa6528000185e5ddd'; // BEATRIZ

async function testCreateNote() {
    console.log('🔍 Testando criação de anotação...');

    const notePayload = {
        deal_note: {
            content: "Teste de anotação via script de debug",
            user_id: USER_ID // Tentando adicionar o usuário explicitamente
        }
    };

    try {
        const url = `${API_URL}/deals/${DEAL_ID}/notes?token=${TOKEN}`;
        console.log(`POST ${url}`);
        console.log('Payload:', JSON.stringify(notePayload, null, 2));

        const response = await axios.post(url, notePayload, {
            headers: { 'Content-Type': 'application/json' }
        });

        console.log('✅ Sucesso! Status:', response.status);
        console.log('Response:', response.data);

    } catch (error) {
        console.error('❌ Erro ao criar anotação:');
        console.error('Status:', error.response?.status);
        console.error('Data:', JSON.stringify(error.response?.data, null, 2));
        console.error('Message:', error.message);
    }
}

testCreateNote();
