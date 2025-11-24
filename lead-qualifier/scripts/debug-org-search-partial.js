require('dotenv').config();
const axios = require('axios');

const TOKEN = process.env.RD_STATION_API_TOKEN;
const API_URL = 'https://crm.rdstation.com/api/v1';

async function debug() {
    const name = "ABRAMAX";
    console.log(`Searching for: "${name}"`);

    try {
        const response = await axios.get(
            `${API_URL}/organizations?token=${TOKEN}`,
            { params: { name } }
        );

        console.log('Response Status:', response.status);
        console.log('Organizations Found:', response.data.organizations.length);

        response.data.organizations.forEach(org => {
            console.log('---');
            console.log('ID:', org.id);
            console.log('Name:', org.name);
        });

    } catch (error) {
        console.error('Error:', error.message);
    }
}

debug();
