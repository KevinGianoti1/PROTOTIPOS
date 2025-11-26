const http = require('http');

function makeRequest(path, method = 'GET') {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({ statusCode: res.statusCode, data: data });
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.end();
    });
}

async function testEndpoints() {
    console.log('Testing endpoints...');

    try {
        // Test 1: Dashboard Stats (Data Fetching)
        console.log('\n1. Testing /api/dashboard/stats...');
        try {
            const stats = await makeRequest('/api/dashboard/stats');
            console.log('Status:', stats.statusCode);
            console.log('Response:', stats.data.substring(0, 200)); // Show first 200 chars
        } catch (e) {
            console.log("Server might not be running yet, which is expected if I just edited it. Please restart server manually.");
        }

        // Test 2: WhatsApp Status
        console.log('\n2. Testing /api/whatsapp/status...');
        try {
            const status = await makeRequest('/api/whatsapp/status');
            console.log('Status:', status.statusCode);
            console.log('Response:', status.data);
        } catch (e) {
            console.log("Server might not be running.");
        }

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testEndpoints();
