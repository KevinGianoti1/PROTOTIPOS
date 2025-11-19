require('dotenv').config();
const axios = require('axios');

/**
 * Script para buscar informações do RD Station CRM
 * Usa o token configurado no .env
 */

const API_URL = process.env.RD_STATION_API_URL || 'https://crm.rdstation.com/api/v1';
const TOKEN = process.env.RD_STATION_API_TOKEN;

const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${TOKEN}`
};

async function buscarPipelines() {
    try {
        console.log('\n📊 Buscando Pipelines (Funis)...\n');
        const response = await axios.get(`${API_URL}/deal_pipelines`, { headers });

        response.data.deal_pipelines.forEach(pipeline => {
            console.log(`Pipeline: ${pipeline.name}`);
            console.log(`  ID: ${pipeline._id}`);
            console.log(`  Etapas:`);
            pipeline.deal_stages.forEach(stage => {
                console.log(`    - ${stage.name} (ID: ${stage._id})`);
            });
            console.log('');
        });

        return response.data;
    } catch (error) {
        console.error('❌ Erro ao buscar pipelines:', error.response?.data || error.message);
    }
}

async function buscarFontes() {
    try {
        console.log('\n📍 Buscando Fontes (Sources)...\n');
        const response = await axios.get(`${API_URL}/deal_sources`, { headers });

        response.data.deal_sources.forEach(source => {
            console.log(`Fonte: ${source.name} (ID: ${source._id})`);
        });
        console.log('');

        return response.data;
    } catch (error) {
        console.error('❌ Erro ao buscar fontes:', error.response?.data || error.message);
    }
}

async function buscarMotivosPerda() {
    try {
        console.log('\n❌ Buscando Motivos de Perda...\n');
        const response = await axios.get(`${API_URL}/deal_lost_reasons`, { headers });

        response.data.deal_lost_reasons.forEach(reason => {
            console.log(`Motivo: ${reason.name} (ID: ${reason._id})`);
        });
        console.log('');

        return response.data;
    } catch (error) {
        console.error('❌ Erro ao buscar motivos de perda:', error.response?.data || error.message);
    }
}

async function buscarUsuarios() {
    try {
        console.log('\n👥 Buscando Usuários (Vendedores)...\n');
        const response = await axios.get(`${API_URL}/users`, { headers });

        response.data.users.forEach(user => {
            console.log(`Usuário: ${user.name} (${user.email}) - ID: ${user._id}`);
        });
        console.log('');

        return response.data;
    } catch (error) {
        console.error('❌ Erro ao buscar usuários:', error.response?.data || error.message);
    }
}

async function main() {
    console.log('🔍 Buscando informações do RD Station CRM...');
    console.log('='.repeat(60));

    if (!TOKEN) {
        console.error('❌ Token não configurado! Configure RD_STATION_API_TOKEN no .env');
        return;
    }

    await buscarPipelines();
    await buscarFontes();
    await buscarMotivosPerda();
    await buscarUsuarios();

    console.log('='.repeat(60));
    console.log('✅ Busca concluída!');
    console.log('\n💡 Use esses IDs para configurar o rdStationService.js');
}

main();
