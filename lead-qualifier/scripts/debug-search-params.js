require('dotenv').config();
const axios = require('axios');

const TOKEN = process.env.RD_STATION_API_TOKEN;
const API_URL = 'https://crm.rdstation.com/api/v1';

async function debug() {
    const name = "ABRAMAX";
    console.log(`Testing search for: "${name}"`);

    const paramsToTest = ['q'];

    for (const param of paramsToTest) {
        console.log(`\n--- Testing param: "${param}" ---`);
        try {
            const response = await axios.get(
                `${API_URL}/organizations?token=${TOKEN}`,
                { params: { [param]: name } }
            );

            console.log(`Count: ${response.data.organizations.length}`);
            const first = response.data.organizations[0];
            console.log(`First result: [${first.id}] ${first.name}`);

            const found = response.data.organizations.find(o => o.name.includes(name));
            if (found) {
                console.log(`✅ FOUND MATCH with param '${param}': ${found.name}`);
            } else {
                console.log(`❌ No match found in first page.`);
            }

        } catch (error) {
            console.error('Error:', error.message);
        }
    }
}

debug();
