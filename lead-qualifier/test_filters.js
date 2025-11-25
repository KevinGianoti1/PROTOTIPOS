/**
 * Script para testar os filtros da API
 */

const baseUrl = 'http://localhost:3000';

async function testFilters() {
    console.log('🧪 Testando Filtros da API...\n');

    // Teste 1: Sem filtros (todos os leads)
    console.log('1️⃣ Teste: Sem filtros (todos)');
    let response = await fetch(`${baseUrl}/api/dashboard/filter`);
    let data = await response.json();
    console.log(`   Resultado: ${data.length} leads\n`);

    // Teste 2: Filtro por Origem = Site
    console.log('2️⃣ Teste: Origem = Site');
    response = await fetch(`${baseUrl}/api/dashboard/filter?origin=Site`);
    data = await response.json();
    console.log(`   Resultado: ${data.length} leads`);
    console.log(`   Primeiros 3:`, data.slice(0, 3).map(l => ({ nome: l.name, origem: l.origin })));
    console.log('');

    // Teste 3: Filtro por Origem = Instagram
    console.log('3️⃣ Teste: Origem = Instagram');
    response = await fetch(`${baseUrl}/api/dashboard/filter?origin=Instagram`);
    data = await response.json();
    console.log(`   Resultado: ${data.length} leads`);
    console.log(`   Primeiros 3:`, data.slice(0, 3).map(l => ({ nome: l.name, origem: l.origin })));
    console.log('');

    // Teste 4: Filtro por Fonte = Site
    console.log('4️⃣ Teste: Fonte = Site');
    response = await fetch(`${baseUrl}/api/dashboard/filter?source=Site`);
    data = await response.json();
    console.log(`   Resultado: ${data.length} leads`);
    console.log(`   Primeiros 3:`, data.slice(0, 3).map(l => ({ nome: l.name, fonte: l.source })));
    console.log('');

    // Teste 5: Filtro por Fonte = Redes Sociais
    console.log('5️⃣ Teste: Fonte = Redes Sociais');
    response = await fetch(`${baseUrl}/api/dashboard/filter?source=Redes%20Sociais`);
    data = await response.json();
    console.log(`   Resultado: ${data.length} leads`);
    console.log(`   Primeiros 3:`, data.slice(0, 3).map(l => ({ nome: l.name, fonte: l.source })));
    console.log('');

    // Teste 6: Filtro por Campanha = Google ADS
    console.log('6️⃣ Teste: Campanha = Google ADS');
    response = await fetch(`${baseUrl}/api/dashboard/filter?campaign=Google%20ADS`);
    data = await response.json();
    console.log(`   Resultado: ${data.length} leads`);
    console.log(`   Primeiros 3:`, data.slice(0, 3).map(l => ({ nome: l.name, campanha: l.campaign })));
    console.log('');

    // Teste 7: Filtro por Campanha = Tráfego Pago
    console.log('7️⃣ Teste: Campanha = Tráfego Pago');
    response = await fetch(`${baseUrl}/api/dashboard/filter?campaign=Tr%C3%A1fego%20Pago`);
    data = await response.json();
    console.log(`   Resultado: ${data.length} leads`);
    console.log(`   Primeiros 3:`, data.slice(0, 3).map(l => ({ nome: l.name, campanha: l.campaign })));
    console.log('');

    // Teste 8: Filtro combinado: Origem=Instagram + Fonte=Redes Sociais
    console.log('8️⃣ Teste: Origem=Instagram + Fonte=Redes Sociais');
    response = await fetch(`${baseUrl}/api/dashboard/filter?origin=Instagram&source=Redes%20Sociais`);
    data = await response.json();
    console.log(`   Resultado: ${data.length} leads`);
    console.log(`   Primeiros 3:`, data.slice(0, 3).map(l => ({ nome: l.name, origem: l.origin, fonte: l.source })));
    console.log('');

    // Teste 9: Filtro por Status = completed
    console.log('9️⃣ Teste: Status = Qualificado');
    response = await fetch(`${baseUrl}/api/dashboard/filter?stage=completed`);
    data = await response.json();
    console.log(`   Resultado: ${data.length} leads`);
    console.log(`   Primeiros 3:`, data.slice(0, 3).map(l => ({ nome: l.name, status: l.stage })));
    console.log('');

    console.log('✅ Testes de filtro concluídos!\n');
    console.log('📊 Se todos os testes retornaram resultados, os filtros estão funcionando!');
    console.log('🌐 Teste manualmente em: http://localhost:3000\n');
}

testFilters().catch(console.error);
