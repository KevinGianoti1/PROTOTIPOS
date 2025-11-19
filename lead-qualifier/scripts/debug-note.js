require('dotenv').config();
const axios = require('axios');

const API_URL = 'https://crm.rdstation.com/api/v1';
const TOKEN = process.env.RD_STATION_API_TOKEN;
// Usando um ID de deal recente para teste
const DEAL_ID = '691e1ac576ee100020e63aae';
const USER_ID = '63d3f64aa6528000185e5ddd'; // BEATRIZ

async function testCreateNote() {
    console.log('🔍 Debugging Note Creation...');

    let dealId;

    // 1. Criar um deal de teste
    try {
        console.log('\n1. Criando deal de teste...');
        const dealPayload = {
            deal: {
                name: "Deal de Teste para Debug de Notas"
            }
        };
        const createResponse = await axios.post(`${API_URL}/deals?token=${TOKEN}`, dealPayload);
        dealId = createResponse.data.id;
        console.log('✅ Deal criado com ID:', dealId);
    } catch (error) {
        console.error('❌ Erro ao criar deal:', error.message);
        return;
    }

    // 2. Tentar endpoint padrão /deals/:id/notes
    try {
        console.log('\n2. Tentando POST /deals/:id/notes...');
        const notePayload = {
            deal_note: {
                content: "Teste endpoint padrão",
                user_id: USER_ID
            }
        };
        await axios.post(`${API_URL}/deals/${dealId}/notes?token=${TOKEN}`, notePayload);
        console.log('✅ Sucesso no endpoint padrão!');
        return;
    } catch (error) {
        console.log('❌ Falha no endpoint padrão:', error.response?.status);
    }

    // 3. Tentar endpoint /activities (alternativa comum)
    try {
        console.log('\n3. Tentando POST /activities...');
        const activityPayload = {
            activity: {
                deal_id: dealId,
                user_id: USER_ID,
                type: 'note',
                text: "Teste endpoint activities"
            }
        };
        await axios.post(`${API_URL}/activities?token=${TOKEN}`, activityPayload);
        console.log('✅ Sucesso no endpoint activities!');
        return;
    } catch (error) {
        console.log('❌ Falha no endpoint activities:', error.response?.status);
    }
}

testCreateNote();
