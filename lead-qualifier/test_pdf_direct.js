const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

async function testPdfParse() {
    try {
        const pdfPath = path.join(__dirname, 'knowledge_base/catalogo.pdf');
        console.log('Testing PDF path:', pdfPath);
        console.log('File exists:', fs.existsSync(pdfPath));

        if (!fs.existsSync(pdfPath)) {
            console.error('File not found!');
            return;
        }

        console.log('Reading file...');
        const dataBuffer = fs.readFileSync(pdfPath);
        console.log('Buffer size:', dataBuffer.length, 'bytes');

        console.log('Parsing PDF...');
        const data = await pdf(dataBuffer);

        console.log('✅ Success!');
        console.log('Pages:', data.numpages);
        console.log('Text length:', data.text.length);
        console.log('First 500 chars:', data.text.substring(0, 500));

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Full error:', error);
    }
}

testPdfParse();
