/**
 * Script de Teste - Popula banco com 20 leads aleatórios
 * Testa: Database, Lead Scoring, Métricas, Dashboard
 */

const databaseService = require('./services/databaseService');
const leadScoringService = require('./services/leadScoringService');
const logger = require('./utils/logger');

// Dados aleatórios para geração de leads
const nomes = [
    'João Silva', 'Maria Santos', 'Pedro Oliveira', 'Ana Costa',
    'Carlos Souza', 'Juliana Lima', 'Roberto Alves', 'Fernanda Rocha',
    'Ricardo Martins', 'Patricia Ferreira', 'Lucas Barbosa', 'Camila Dias',
    'Bruno Cardoso', 'Amanda Ribeiro', 'Felipe Araújo', 'Gabriela Mendes',
    'Rodrigo Carvalho', 'Beatriz Gomes', 'Thiago Pereira', 'Larissa Moreira'
];

const empresas = [
    { razao: 'Construções ABC Ltda', fantasia: 'ABC Construções', porte: 'EPP' },
    { razao: 'Distribuidora XYZ ME', fantasia: 'XYZ Ferramentas', porte: 'ME' },
    { razao: 'Marmoraria Pedra Forte', fantasia: 'Pedra Forte', porte: 'ME' },
    { razao: 'Loja de Materiais Silva', fantasia: 'Silva Materiais', porte: 'EPP' },
    { razao: 'Serralheria Metal Forte Ltda', fantasia: 'Metal Forte', porte: 'ME' },
    { razao: 'Revendedora Premium EIRELI', fantasia: 'Premium Tools', porte: 'DEMAIS' },
    { razao: 'Construtora Alicerce SA', fantasia: 'Alicerce', porte: 'DEMAIS' },
    { razao: 'Distribuidora Norte Sul', fantasia: 'Norte Sul', porte: 'EPP' },
    { razao: 'Ferragens e Ferramentas JK', fantasia: 'JK Ferragens', porte: 'ME' },
    { razao: 'Marmoraria Granito Real', fantasia: 'Granito Real', porte: 'ME' },
    { razao: 'Loja do Construtor Ltda', fantasia: 'Loja do Construtor', porte: 'EPP' },
    { razao: 'Serralheria Moderna ME', fantasia: 'Serralheria Moderna', porte: 'ME' },
    { razao: 'Distribuidora Central', fantasia: 'Central Ferramentas', porte: 'DEMAIS' },
    { razao: 'Materiais de Construção Forte', fantasia: 'Forte Materiais', porte: 'EPP' },
    { razao: 'Ferramentas Profissionais Ltda', fantasia: 'Pro Tools', porte: 'EPP' },
    { razao: 'Marmoraria Pedras Nobres', fantasia: 'Pedras Nobres', porte: 'ME' },
    { razao: 'Construtora Horizonte', fantasia: 'Horizonte', porte: 'DEMAIS' },
    { razao: 'Distribuidora Sul Ferramentas', fantasia: 'Sul Ferramentas', porte: 'EPP' },
    { razao: 'Serralheria Arte em Ferro', fantasia: 'Arte em Ferro', porte: 'ME' },
    { razao: 'Loja Mega Ferramentas', fantasia: 'Mega Ferramentas', porte: 'DEMAIS' }
];

const cnaes = [
    { codigo: '4744001', descricao: 'Comércio varejista de ferragens e ferramentas', valido: true },
    { codigo: '4744099', descricao: 'Comércio varejista de materiais de construção', valido: true },
    { codigo: '4672900', descricao: 'Comércio atacadista de ferragens e ferramentas', valido: true },
    { codigo: '4330404', descricao: 'Instalação de portas, janelas, tetos', valido: false },
    { codigo: '2511000', descricao: 'Fabricação de estruturas metálicas', valido: false },
    { codigo: '4120400', descricao: 'Construção de edifícios', valido: false }
];

const cidades = [
    { cidade: 'São Paulo', estado: 'SP' },
    { cidade: 'Rio de Janeiro', estado: 'RJ' },
    { cidade: 'Belo Horizonte', estado: 'MG' },
    { cidade: 'Curitiba', estado: 'PR' },
    { cidade: 'Porto Alegre', estado: 'RS' },
    { cidade: 'Salvador', estado: 'BA' },
    { cidade: 'Brasília', estado: 'DF' },
    { cidade: 'Fortaleza', estado: 'CE' },
    { cidade: 'Recife', estado: 'PE' },
    { cidade: 'Campinas', estado: 'SP' }
];

const produtos = [
    'Disco de corte para porcelanato',
    'Serra diamantada para granito',
    'Lixa diamantada para inox',
    'Broca diamantada para vidro',
    'Disco de desbaste para concreto',
    'Serra copo diamantada',
    'Rebolo diamantado',
    'Disco flap para metal'
];

const origens = ['Site', 'Instagram'];
const fontes = ['Site', 'Redes Sociais'];
const campanhas = ['Google ADS', 'Tráfego Pago'];

function randomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomBoolean() {
    return Math.random() > 0.5;
}

function generatePhone() {
    const ddd = randomInt(11, 99);
    const numero = randomInt(900000000, 999999999);
    return `55${ddd}${numero}`;
}

function generateEmail(nome) {
    const dominios = ['gmail.com', 'hotmail.com', 'outlook.com', 'empresa.com.br'];
    const username = nome.toLowerCase().replace(' ', '.');
    return `${username}@${randomItem(dominios)}`;
}

async function createTestLead(index) {
    const phone = generatePhone();
    const nome = nomes[index];
    const empresa = empresas[index];
    const cnae = randomItem(cnaes);
    const local = randomItem(cidades);
    const produto = randomItem(produtos);

    // Cria contato
    await databaseService.createContact(phone, {});

    // Dados básicos
    // Dados básicos
    const origin = randomItem(origens);
    let source, campaign;

    if (origin === 'Site') {
        source = 'Site';
        campaign = 'Google ADS';
    } else {
        source = 'Redes Sociais';
        campaign = 'Tráfego Pago';
    }

    const updates = {
        name: nome,
        email: generateEmail(nome),
        cnpj: `${randomInt(10, 99)}.${randomInt(100, 999)}.${randomInt(100, 999)}/0001-${randomInt(10, 99)}`,
        origin: origin,
        source: source,
        campaign: campaign,

        // Dados da empresa
        razao_social: empresa.razao,
        nome_fantasia: empresa.fantasia,
        cnae_principal: cnae.codigo,
        cnae_descricao: cnae.descricao,
        cnae_valido: cnae.valido,
        porte_empresa: empresa.porte,
        capital_social: randomInt(10000, 500000),
        data_abertura: `${randomInt(2000, 2023)}-${String(randomInt(1, 12)).padStart(2, '0')}-${String(randomInt(1, 28)).padStart(2, '0')}`,
        situacao_cadastral: 'Ativa',

        // Endereço
        logradouro: `Rua ${randomItem(['das Flores', 'Principal', 'do Comércio', 'Industrial'])}`,
        numero: String(randomInt(1, 9999)),
        bairro: randomItem(['Centro', 'Industrial', 'Comercial', 'Vila Nova']),
        cidade: local.cidade,
        estado: local.estado,
        cep: `${randomInt(10000, 99999)}-${randomInt(100, 999)}`,

        // Informações do lead
        cargo_contato: randomItem(['Gerente de Compras', 'Proprietário', 'Diretor', 'Comprador']),
        departamento: randomItem(['Compras', 'Manutenção', 'Produção', 'Comercial']),
        produto_interesse: produto,
        quantidade_estimada: String(randomInt(10, 500)),
        prazo_compra: randomItem(['Imediato', '15 dias', '30 dias', '60 dias']),
        ticket_medio: randomInt(500, 50000),

        // Engajamento (simulado)
        total_mensagens: randomInt(1, 20),
        ultima_interacao: new Date(Date.now() - randomInt(0, 7 * 24 * 60 * 60 * 1000)).toISOString(),
        tempo_resposta_medio: randomInt(60, 3600), // 1 min a 1 hora
        catalogo_enviado: randomBoolean(),
        audio_recebido: randomBoolean(),

        // Stage
        stage: cnae.valido ? (randomBoolean() ? 'completed' : 'initial') : 'disqualified',
        motivo_desqualificacao: !cnae.valido ? 'CNAE fora do perfil' : null
    };

    await databaseService.updateContact(phone, updates);

    // Calcula score
    await leadScoringService.scoreContact(phone);

    const contact = await databaseService.getContact(phone);

    logger.info(`✅ Lead ${index + 1}/20 criado: ${nome} (${empresa.fantasia}) - Score: ${contact.lead_score} (${contact.temperatura})`);

    return contact;
}

async function runTests() {
    try {
        logger.info('🧪 Iniciando testes com 20 leads aleatórios...\n');

        // Inicializa banco
        await databaseService.init();
        await databaseService.clearAllContacts();

        // Cria 20 leads
        const leads = [];
        for (let i = 0; i < 20; i++) {
            const lead = await createTestLead(i);
            leads.push(lead);

            // Pequeno delay para não sobrecarregar
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        logger.info('\n📊 Resumo dos Testes:\n');

        // Estatísticas
        const stats = await databaseService.getDashboardStats();
        logger.info(`Total de Leads: ${stats.total}`);
        logger.info(`Qualificados: ${stats.qualified}`);
        logger.info(`Desqualificados: ${stats.disqualified}`);
        logger.info(`Taxa de Conversão: ${stats.conversionRate}%\n`);

        // Estatísticas avançadas
        const advStats = await databaseService.getAdvancedStats();
        logger.info('📈 Estatísticas Avançadas:');
        logger.info(`Ticket Médio: R$ ${advStats.avgTicket}`);
        logger.info(`Taxa de Resposta: ${advStats.responseRate}%`);
        logger.info(`Catálogos Enviados: ${advStats.catalogsSent}`);
        logger.info(`Tempo Médio de Qualificação: ${advStats.avgQualificationTime}h\n`);

        // Distribuição por temperatura
        logger.info('🌡️ Distribuição por Temperatura:');
        advStats.byTemperature.forEach(t => {
            const emoji = t.name === 'Quente' ? '🔥' : t.name === 'Morno' ? '🟡' : '❄️';
            logger.info(`${emoji} ${t.name}: ${t.count}`);
        });

        // Distribuição de scores
        logger.info('\n📊 Distribuição de Scores:');
        const scoreDistribution = await databaseService.getLeadScoreDistribution();
        scoreDistribution.forEach(s => {
            logger.info(`${s.range}: ${s.count} leads`);
        });

        // Top CNAEs
        logger.info('\n🏢 Top 5 CNAEs:');
        const topCNAEs = await databaseService.getTopCNAEs(5);
        topCNAEs.forEach((c, i) => {
            logger.info(`${i + 1}. ${c.name}: ${c.count}`);
        });

        // Top Produtos
        logger.info('\n🛠️ Top 5 Produtos:');
        const topProducts = await databaseService.getTopProducts(5);
        topProducts.forEach((p, i) => {
            logger.info(`${i + 1}. ${p.name}: ${p.count}`);
        });

        // Distribuição geográfica
        logger.info('\n🗺️ Distribuição Geográfica:');
        const geo = await databaseService.getGeographicDistribution();
        geo.forEach((g, i) => {
            logger.info(`${i + 1}. ${g.name}: ${g.count}`);
        });

        // Funil
        logger.info('\n🎯 Funil de Conversão:');
        const funnel = await databaseService.getFunnelData();
        funnel.forEach(f => {
            logger.info(`${f.stage}: ${f.count}`);
        });

        logger.info('\n✅ Testes concluídos com sucesso!');
        logger.info('🌐 Acesse o dashboard em: http://localhost:3000\n');

        process.exit(0);

    } catch (error) {
        logger.error('❌ Erro nos testes:', error);
        process.exit(1);
    }
}

// Executa testes
runTests();
