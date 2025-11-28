const marciaService = require('./services/marciaAgentService');
const databaseService = require('./services/databaseService');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testFullFlow() {
    try {
        console.log('🚀 INICIANDO TESTE COMPLETO DO SISTEMA (END-TO-END)\n');

        // Use a random phone number to start fresh every time
        const phoneNumber = '55119' + Math.floor(Math.random() * 100000000);
        console.log(`📱 Simulando cliente: ${phoneNumber}\n`);

        await databaseService.init();

        // Scenario:
        // 1. Greeting + Origin (Instagram)
        // 2. Invalid CNPJ (13 digits)
        // 3. Valid CNPJ
        // 4. Name
        // 5. Phone
        // 6. Email
        // 7. Type (Revenda)
        // 8. Product (Serra)
        // 9. Quantity/Deadline
        // 10. Checkpoint Confirmation

        const conversation = [
            {
                step: '1. Saudação + Origem',
                input: 'Olá, vi um anúncio de vocês no Instagram e fiquei interessado.'
            },
            {
                step: '2. CNPJ Inválido (Teste de Regex)',
                input: 'Meu CNPJ é 4354607000152' // 13 digits
            },
            {
                step: '3. CNPJ Válido',
                input: 'Ops, digitei errado. É 43.546.070/0001-52'
            },
            {
                step: '4. Nome',
                input: 'Me chamo Carlos da Silva'
            },
            {
                step: '5. Telefone',
                input: 'Meu número é esse mesmo'
            },
            {
                step: '6. Email',
                input: 'carlos.silva@vendamais.com.br'
            },
            {
                step: '7. Tipo de Empresa',
                input: 'Somos uma revenda de ferramentas'
            },
            {
                step: '8. Produto',
                input: 'Tenho interesse em serras silenciosas para granito'
            },
            {
                step: '9. Quantidade e Prazo',
                input: 'Umas 20 peças pra semana que vem'
            },
            {
                step: '10. Checkpoint (Confirmação)',
                input: 'Sim, está tudo correto!'
            }
        ];

        for (const turn of conversation) {
            console.log(`\n🔹 [${turn.step}]`);
            console.log(`👤 Cliente: "${turn.input}"`);

            // Simulate typing delay
            process.stdout.write('🤖 Márcia digitando...');
            const response = await marciaService.processMessage(phoneNumber, turn.input);
            console.log('\r' + ' '.repeat(20) + '\r'); // Clear "digitando..."

            console.log(`🤖 Márcia:\n${response}\n`);

            // Check for specific conditions
            if (turn.step.includes('CNPJ Inválido')) {
                if (response.includes('incorreto') || response.includes('verificar')) {
                    console.log('✅ SUCESSO: Márcia detectou CNPJ inválido!');
                } else {
                    console.log('❌ FALHA: Márcia aceitou CNPJ inválido ou não reclamou.');
                }
            }

            if (turn.step.includes('Checkpoint')) {
                if (response.includes('[COMPLETE]')) {
                    console.log('✅ SUCESSO: Tag [COMPLETE] gerada!');
                    const jsonMatch = response.match(/\[COMPLETE\](\{.*\})/);
                    if (jsonMatch) {
                        const data = JSON.parse(jsonMatch[1]);
                        console.log('📊 DADOS FINAIS:', JSON.stringify(data, null, 2));

                        // Validations
                        if (data.origin && data.origin.toLowerCase().includes('insta')) {
                            console.log('✅ Origem detectada corretamente: Instagram');
                        } else {
                            console.log('⚠️ AVISO: Origem pode estar incorreta:', data.origin);
                        }
                    }
                } else {
                    console.log('❌ FALHA: Tag [COMPLETE] não foi gerada após confirmação.');
                }
            }

            // Wait a bit to not hit rate limits
            await sleep(2000);
        }

        console.log('\n🏁 Teste finalizado!');
        process.exit(0);

    } catch (error) {
        console.error('\n❌ Erro fatal no teste:', error);
        process.exit(1);
    }
}

testFullFlow();
