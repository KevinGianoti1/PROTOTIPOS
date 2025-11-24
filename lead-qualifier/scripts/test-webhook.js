const axios = require('axios');

async function testWebhook() {
    try {
        const payload = {
            cnpj: "08.054.886/0001-68",
            nome: "Teste Webhook Fix Org",
            telefone: "(11) 98888-8888",
            email: "teste.webhook@exemplo.com",
            origem: "Instagram"
        };

        console.log('Sending webhook payload:', payload);

        const response = await axios.post('http://localhost:3000/webhook/lead', payload);
        console.log('Response:', response.data);

    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Data:', error.response.data);
        }
    }
}

testWebhook();
