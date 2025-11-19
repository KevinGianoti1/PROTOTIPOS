require('dotenv').config();
const axios = require('axios');

/**
 * Script para buscar IDs de uma oportunidade específica
 */

const API_URL = 'https://crm.rdstation.com/api/v1';
const TOKEN = process.env.RD_STATION_API_TOKEN;
const DEAL_ID = '691e27a1477d7b0023e1ff2e';

async function buscarDeal() {
    try {
        console.log('🔍 Buscando informações da oportunidade...\n');

        const response = await axios.get(
            `${API_URL}/deals/${DEAL_ID}?token=${TOKEN}`
        );

        const deal = response.data;

        console.log('✅ DADOS DA OPORTUNIDADE:\n');
        console.log('═'.repeat(60));

        console.log('\n📊 INFORMAÇÕES BÁSICAS:');
        console.log(`Nome: ${deal.name}`);
        console.log(`ID: ${deal._id}`);

        console.log('\n🎯 FUNIL E ETAPA:');
        console.log(`Pipeline ID: ${deal.deal_pipeline_id}`);
        console.log(`Stage ID: ${deal.deal_stage_id}`);

        if (deal.deal_source) {
            console.log('\n📍 FONTE:');
            console.log(`Source ID: ${deal.deal_source._id || deal.deal_source_id}`);
            console.log(`Source Nome: ${deal.deal_source.name || 'N/A'}`);
        }

        if (deal.campaign) {
            console.log('\n📢 CAMPANHA:');
            console.log(`Campaign ID: ${deal.campaign._id || deal.campaign_id}`);
            console.log(`Campaign Nome: ${deal.campaign.name || 'N/A'}`);
        }

        if (deal.user) {
            console.log('\n👤 USUÁRIO RESPONSÁVEL:');
            console.log(`User ID: ${deal.user._id || deal.user_id}`);
            console.log(`User Nome: ${deal.user.name || 'N/A'}`);
        }

        if (deal.organization) {
            console.log('\n🏢 ORGANIZAÇÃO:');
            console.log(`Org ID: ${deal.organization._id || deal.organization_id}`);
            console.log(`Org Nome: ${deal.organization.name}`);
        }

        if (deal.deal_contacts) {
            console.log('\n📞 CONTATOS:');
            deal.deal_contacts.forEach(contact => {
                console.log(`- Nome: ${contact.name} (ID: ${contact.id})`);
            });
        }

        console.log('\n' + '═'.repeat(60));
        console.log('\n📋 OBJETO COMPLETO (JSON):\n');
        console.log(JSON.stringify(deal, null, 2));

    } catch (error) {
        console.error('❌ Erro ao buscar oportunidade:', error.response?.data || error.message);
    }
}

buscarDeal();
