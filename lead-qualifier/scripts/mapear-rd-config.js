require('dotenv').config();
const axios = require('axios');

/**
 * Script para mapear todos os IDs do RD Station CRM
 */

const API_URL = 'https://crm.rdstation.com/api/v1';
const TOKEN = process.env.RD_STATION_API_TOKEN;

async function fetchWithToken(endpoint) {
    try {
        const response = await axios.get(`${API_URL}${endpoint}?token=${TOKEN}`);
        return response.data;
    } catch (error) {
        console.error(`Erro ao buscar ${endpoint}:`, error.response?.data || error.message);
        return null;
    }
}

async function mapearPipelines() {
    console.log('\n📊 ========== PIPELINES (FUNIS) ==========\n');

    const data = await fetchWithToken('/deal_pipelines');
    if (!data || !data.deal_pipelines) {
        console.log('   Nenhum pipeline encontrado ou erro ao buscar.');
        return;
    }

    data.deal_pipelines.forEach((pipeline, index) => {
        console.log(`\n${index + 1}. Pipeline: ${pipeline.name}`);
        console.log(`   ID: ${pipeline._id}`);
        console.log(`   Etapas (Stages):`);

        if (pipeline.deal_stages && pipeline.deal_stages.length > 0) {
            pipeline.deal_stages.forEach((stage, stageIndex) => {
                console.log(`      ${stageIndex + 1}. ${stage.name}`);
                console.log(`         ID: ${stage._id}`);
                console.log(`         Tipo: ${stage.type || 'N/A'}`);
            });
        } else {
            console.log(`      Nenhuma etapa encontrada.`);
        }
    });
}

async function mapearFontes() {
    console.log('\n\n📍 ========== FONTES (SOURCES) ==========\n');

    const data = await fetchWithToken('/deal_sources');
    if (!data || !data.deal_sources) {
        console.log('   Nenhuma fonte encontrada ou erro ao buscar.');
        return;
    }

    data.deal_sources.forEach((source, index) => {
        console.log(`${index + 1}. ${source.name}`);
        console.log(`   ID: ${source._id}`);
    });
}

async function mapearMotivosPerda() {
    console.log('\n\n❌ ========== MOTIVOS DE PERDA ==========\n');

    const data = await fetchWithToken('/deal_lost_reasons');
    if (!data || !data.deal_lost_reasons) {
        console.log('   Nenhum motivo de perda encontrado ou erro ao buscar.');
        return;
    }

    data.deal_lost_reasons.forEach((reason, index) => {
        console.log(`${index + 1}. ${reason.name}`);
        console.log(`   ID: ${reason._id}`);
    });
}

async function mapearUsuarios() {
    console.log('\n\n👥 ========== USUÁRIOS (VENDEDORES) ==========\n');

    const data = await fetchWithToken('/users');
    if (!data || !data.users) {
        console.log('   Nenhum usuário encontrado ou erro ao buscar.');
        return;
    }

    data.users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   ID: ${user._id}`);
    });
}

async function main() {
    console.log('🔍 MAPEANDO CONFIGURAÇÕES DO RD STATION CRM');
    console.log('='.repeat(60));

    if (!TOKEN) {
        console.error('\n❌ Token não configurado! Configure RD_STATION_API_TOKEN no .env');
        return;
    }

    await mapearPipelines();
    await mapearFontes();
    await mapearMotivosPerda();
    await mapearUsuarios();

    console.log('\n' + '='.repeat(60));
    console.log('✅ Mapeamento concluído!');
    console.log('\n💡 Agora você pode escolher os IDs para configurar no sistema.');
}

main();
