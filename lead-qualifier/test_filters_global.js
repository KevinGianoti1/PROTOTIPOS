const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api/dashboard';

async function testGlobalFilters() {
    console.log('🚀 Iniciando testes de filtragem global...');

    try {
        // 1. Teste Básico: Sem filtros
        console.log('\n1️⃣  Teste sem filtros:');
        const statsNoFilter = await axios.get(`${BASE_URL}/stats`);
        console.log(`   Total Leads: ${statsNoFilter.data.total}`);

        // 2. Teste Filtro Origem: Site
        console.log('\n2️⃣  Teste Filtro Origem = Site:');
        const statsSite = await axios.get(`${BASE_URL}/stats?origin=Site`);
        console.log(`   Total Leads (Site): ${statsSite.data.total}`);

        const advancedStatsSite = await axios.get(`${BASE_URL}/advanced-stats?origin=Site`);
        console.log(`   Ticket Médio (Site): R$ ${advancedStatsSite.data.avgTicket}`);

        // 3. Teste Filtro Data (Últimos 30 dias vs Futuro)
        console.log('\n3️⃣  Teste Filtro Data:');
        const today = new Date().toISOString().split('T')[0];
        const futureDate = '2025-01-01'; // Data futura

        const statsDate = await axios.get(`${BASE_URL}/stats?start_date=${today}`);
        console.log(`   Total Leads (Hoje+): ${statsDate.data.total}`);

        const statsFuture = await axios.get(`${BASE_URL}/stats?start_date=${futureDate}`);
        console.log(`   Total Leads (Futuro): ${statsFuture.data.total} (Esperado: 0 ou baixo)`);

        // 4. Teste Filtro Combinado (Origem + Status)
        console.log('\n4️⃣  Teste Filtro Combinado (Site + Qualificado):');
        const funnelSiteQual = await axios.get(`${BASE_URL}/funnel?origin=Site&stage=completed`);
        const qualifiedCount = funnelSiteQual.data.find(s => s.stage === 'Qualificado').count;
        console.log(`   Leads Qualificados (Site): ${qualifiedCount}`);

        // 5. Teste Filtro CNAE (Top CNAEs com filtro de origem)
        console.log('\n5️⃣  Teste Top CNAEs (Filtrado por Origem = Instagram):');
        const topCnaesInsta = await axios.get(`${BASE_URL}/top-cnaes?origin=Instagram`);
        console.log(`   Top CNAEs (Instagram):`, topCnaesInsta.data.map(c => `${c.name} (${c.count})`));

    } catch (error) {
        console.error('❌ Erro no teste:', error.message);
        if (error.response) {
            console.error('   Detalhes:', error.response.data);
        }
    }
}

testGlobalFilters();
