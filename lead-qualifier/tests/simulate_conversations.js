require('dotenv').config();
const { MarciaAgentService } = require('../services/marciaAgentService');
const MockDatabaseService = require('./mocks/MockDatabaseService');
const MockRDStationService = require('./mocks/MockRDStationService');
const logger = require('../utils/logger');

// Configuração de cores para o console
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    fgGreen: "\x1b[32m",
    fgYellow: "\x1b[33m",
    fgBlue: "\x1b[34m",
    fgRed: "\x1b[31m",
    fgCyan: "\x1b[36m"
};

async function runSimulation() {
    console.log(`${colors.bright}${colors.fgCyan}🚀 Iniciando Simulação de Conversas da Márcia${colors.reset}\n`);

    const scenarios = [
        {
            name: "Cenário 1: Caminho Feliz (Instagram)",
            phone: "5511999990001",
            messages: [
                "Olá, gostaria de saber sobre serras",
                "08.054.886/0001-68", // CNPJ válido (Abramax)
                "Kevin",
                "11999990001",
                "kevin@teste.com",
                "Distribuidora",
                "Vi no insta",
                "Serra de concreto",
                "100 peças",
                "Pra semana que vem",
                "Sim" // Confirmação final
            ]
        },
        {
            name: "Cenário 2: Caminho Feliz (Site)",
            phone: "5511999990002",
            messages: [
                "Bom dia",
                "08.054.886/0001-68",
                "Maria",
                "11999990002",
                "maria@teste.com",
                "Revenda",
                "Achei no Google",
                "Discos de corte",
                "50 unidades",
                "Urgente",
                "Sim"
            ]
        },
        {
            name: "Cenário 3: Dados Inválidos (Correção)",
            phone: "5511999990003",
            messages: [
                "Oi",
                "00000000000", // CNPJ Inválido
                "Ops, digitei errado. É 08.054.886/0001-68", // Correção
                "João",
                "11999990003",
                "joao@teste.com",
                "Lojista",
                "Indicação", // Deve cair no fallback (Site) ou ser tratado se houver lógica específica
                "Brocas",
                "10",
                "Mês que vem",
                "Sim"
            ]
        },
        {
            name: "Cenário 4: Usuário Objetivo (Tudo em uma mensagem)",
            phone: "5511999990004",
            messages: [
                "Olá, sou Kevin da Abramax (CNPJ 08.054.886/0001-68), quero cotar 200 serras. Vi no insta.",
                "11999990004", // Telefone
                "kevin@abramax.com", // Email
                "Distribuidora", // Perfil
                "Pra ontem", // Prazo
                "Sim" // Confirmação
            ]
        }
    ];

    for (const scenario of scenarios) {
        console.log(`\n${colors.bright}${colors.fgYellow}▶️ Executando: ${scenario.name}${colors.reset}`);
        console.log(`${colors.fgYellow}----------------------------------------${colors.reset}`);

        // Inicializa Mocks para cada cenário (estado limpo)
        const mockDb = new MockDatabaseService();
        const mockRd = new MockRDStationService();
        await mockDb.init();

        // Instancia o Agente com Mocks
        const marcia = new MarciaAgentService(mockDb, mockRd);

        for (const userMsg of scenario.messages) {
            // Simula delay de digitação do usuário
            await new Promise(r => setTimeout(r, 500));

            console.log(`${colors.fgGreen}👤 User:${colors.reset} ${userMsg}`);

            try {
                const response = await marcia.processMessage(scenario.phone, userMsg);
                console.log(`${colors.fgBlue}🤖 Márcia:${colors.reset} ${response}\n`);
            } catch (error) {
                console.error(`${colors.fgRed}❌ Erro:${colors.reset}`, error);
            }
        }

        // Verifica estado final no Mock DB
        const contact = await mockDb.getContact(scenario.phone);
        console.log(`${colors.fgCyan}📊 Estado Final do Lead:${colors.reset}`);
        console.log(JSON.stringify(contact, null, 2));

        // Verifica se foi enviado para o Mock RD
        const sentToRd = mockRd.leads.find(l => l.lead.telefone.includes(scenario.phone.slice(-8)));
        if (sentToRd) {
            console.log(`${colors.fgGreen}✅ Lead enviado para o CRM!${colors.reset}`);
            console.log(`   Origem detectada: ${sentToRd.lead.origem}`);
        } else {
            console.log(`${colors.fgRed}⚠️ Lead NÃO enviado para o CRM.${colors.reset}`);
        }

        console.log(`${colors.fgYellow}----------------------------------------${colors.reset}\n`);
    }

    console.log(`${colors.bright}${colors.fgCyan}🏁 Simulação Concluída!${colors.reset}`);
}

runSimulation().catch(console.error);
