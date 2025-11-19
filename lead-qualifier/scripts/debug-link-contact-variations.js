require('dotenv').config();
const axios = require('axios');

const TOKEN = process.env.RD_STATION_API_TOKEN;
const API_URL = 'https://crm.rdstation.com/api/v1';
const DEAL_ID = '691e25e42573d00019a8c548'; // Deal existente
const CONTACT_ID = '691e25e458e8ff001393b794'; // Contato existente

async function debug() {
    try {
        console.log('1. Tentando contacts: [{ id: ... }]');
        try {
            await axios.put(`${API_URL}/deals/${DEAL_ID}?token=${TOKEN}`, {
                deal: {
                    contacts: [{ id: CONTACT_ID }]
                }
            });
            console.log('   Sucesso (sem erro)');
        } catch (e) { console.log('   Erro:', e.response?.status); }

        console.log('2. Tentando contacts: [{ contact_id: ... }]');
        try {
            await axios.put(`${API_URL}/deals/${DEAL_ID}?token=${TOKEN}`, {
                deal: {
                    contacts: [{ contact_id: CONTACT_ID }]
                }
            });
            console.log('   Sucesso (sem erro)');
        } catch (e) { console.log('   Erro:', e.response?.status); }

        console.log('3. Tentando deal_contacts com id');
        try {
            await axios.put(`${API_URL}/deals/${DEAL_ID}?token=${TOKEN}`, {
                deal: {
                    deal_contacts: [{ id: CONTACT_ID }]
                }
            });
            console.log('   Sucesso (sem erro)');
        } catch (e) { console.log('   Erro:', e.response?.status); }

    } catch (error) {
        console.error('ERRO GERAL:', error.message);
    }
}

debug();
