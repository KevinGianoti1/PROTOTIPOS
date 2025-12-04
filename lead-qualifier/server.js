// Server setup for Lead Qualifier Dashboard
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const QRCode = require('qrcode');
const http = require('http');
const { Server } = require('socket.io');

const cnpjService = require('./services/cnpjService');
const validationService = require('./services/validationService');
const rdStationService = require('./services/rdStationService');
const whatsappService = require('./services/whatsappService');
const databaseService = require('./services/databaseService');
const knowledgeBaseService = require('./services/knowledgeBaseService');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 3000;

// Make io available globally for real-time updates
global.io = io;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve main page
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        rdStationConfigured: rdStationService.isConfigured(),
        timestamp: new Date().toISOString()
    });
});

// Webhook – receives lead data from external forms
app.post('/webhook/lead', async (req, res) => {
    try {
        const { cnpj, nome, telefone, origem } = req.body;
        if (!cnpj || !nome || !telefone) {
            return res.status(400).json({ success: false, error: 'Campos obrigatórios: cnpj, nome, telefone' });
        }
        logger.info('Novo lead recebido', { cnpj, nome, origem: origem || 'não informado' });
        const resultado = await validationService.processarLead({ cnpj, nome, telefone, origem: origem || 'Teste' }, cnpjService, databaseService);
        let rdStationResult = null;
        if (rdStationService.isConfigured()) {
            try {
                rdStationResult = await rdStationService.processLead(resultado);
            } catch (rdError) {
                logger.error('Erro na integração RD Station (continuando...)', { error: rdError.message });
                rdStationResult = { success: false, error: rdError.message };
            }
        } else {
            logger.info('RD Station não configurado - modo teste');
            rdStationResult = { mode: 'test', message: 'RD Station não configurado' };
        }
        res.json({ success: true, resultado: { lead: resultado.lead, empresa: resultado.empresa, validacao: resultado.validacao, rdStation: rdStationResult } });
    } catch (error) {
        logger.error('Erro ao processar lead', { error: error.message });
        res.status(500).json({ success: false, error: error.message });
    }
});

// CNAE permitidos endpoint
app.get('/api/cnaes-permitidos', (req, res) => {
    const cnaes = validationService.getCNAEsPermitidos();
    res.json({ success: true, total: cnaes.length, cnaes });
});

// Dashboard statistics
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const filters = {
            origin: req.query.origin || undefined,
            source: req.query.source || undefined,
            campaign: req.query.campaign || undefined,
            stage: req.query.stage || undefined,
            cnae: req.query.cnae || undefined,
            product: req.query.product || undefined,
            state: req.query.state || undefined,
            city: req.query.city || undefined,
            start_date: req.query.start_date || undefined,
            end_date: req.query.end_date || undefined
        };
        const stats = await databaseService.getDashboardStats(filters);
        res.json(stats);
    } catch (error) {
        logger.error('Erro ao buscar stats:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Daily leads chart data
app.get('/api/dashboard/chart', async (req, res) => {
    try {
        const data = await databaseService.getDailyLeads();
        res.json(data);
    } catch (error) {
        logger.error('Erro ao buscar dados do gráfico:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Recent leads table
app.get('/api/dashboard/recent', async (req, res) => {
    try {
        const leads = await databaseService.getRecentLeads();
        res.json(leads);
    } catch (error) {
        logger.error('Erro ao buscar leads recentes:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Unique origins for filter dropdown
app.get('/api/dashboard/origins', async (req, res) => {
    try {
        const origins = await databaseService.getUniqueOrigins();
        res.json({ origins });
    } catch (error) {
        logger.error('Erro ao buscar origens únicas:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Unique sources for filter dropdown
app.get('/api/dashboard/sources', async (req, res) => {
    try {
        const sources = await databaseService.getUniqueSources();
        res.json({ sources });
    } catch (error) {
        logger.error('Erro ao buscar fontes únicas:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Unique campaigns for filter dropdown
app.get('/api/dashboard/campaigns', async (req, res) => {
    try {
        const campaigns = await databaseService.getUniqueCampaigns();
        res.json({ campaigns });
    } catch (error) {
        logger.error('Erro ao buscar campanhas únicas:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Filtered leads endpoint – accepts query params origin, source, campaign, stage
app.get('/api/dashboard/filter', async (req, res) => {
    try {
        const filters = {
            origin: req.query.origin || undefined,
            source: req.query.source || undefined,
            campaign: req.query.campaign || undefined,
            stage: req.query.stage || undefined,
            cnae: req.query.cnae || undefined,
            product: req.query.product || undefined,
            state: req.query.state || undefined,
            city: req.query.city || undefined,
            start_date: req.query.start_date || undefined,
            end_date: req.query.end_date || undefined
        };
        const leads = await databaseService.getLeadsByFilter(filters);
        res.json(leads);
    } catch (error) {
        logger.error('Erro ao buscar leads filtrados:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// --- New Phase 1 Endpoints ---

// Advanced statistics
app.get('/api/dashboard/advanced-stats', async (req, res) => {
    try {
        const filters = {
            origin: req.query.origin || undefined,
            source: req.query.source || undefined,
            campaign: req.query.campaign || undefined,
            stage: req.query.stage || undefined,
            cnae: req.query.cnae || undefined,
            product: req.query.product || undefined,
            state: req.query.state || undefined,
            city: req.query.city || undefined,
            start_date: req.query.start_date || undefined,
            end_date: req.query.end_date || undefined
        };
        const stats = await databaseService.getAdvancedStats(filters);
        res.json(stats);
    } catch (error) {
        logger.error('Erro ao buscar estatísticas avançadas:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Lead score distribution
app.get('/api/dashboard/lead-score-distribution', async (req, res) => {
    try {
        const filters = {
            origin: req.query.origin || undefined,
            source: req.query.source || undefined,
            campaign: req.query.campaign || undefined,
            stage: req.query.stage || undefined,
            cnae: req.query.cnae || undefined,
            product: req.query.product || undefined,
            state: req.query.state || undefined,
            city: req.query.city || undefined,
            start_date: req.query.start_date || undefined,
            end_date: req.query.end_date || undefined
        };
        const distribution = await databaseService.getLeadScoreDistribution(filters);
        res.json(distribution);
    } catch (error) {
        logger.error('Erro ao buscar distribuição de scores:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Top CNAEs
app.get('/api/dashboard/top-cnaes', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;
        const filters = {
            origin: req.query.origin || undefined,
            source: req.query.source || undefined,
            campaign: req.query.campaign || undefined,
            stage: req.query.stage || undefined,
            cnae: req.query.cnae || undefined,
            product: req.query.product || undefined,
            state: req.query.state || undefined,
            city: req.query.city || undefined,
            start_date: req.query.start_date || undefined,
            end_date: req.query.end_date || undefined
        };
        const topCNAEs = await databaseService.getTopCNAEs(limit, filters);
        res.json(topCNAEs);
    } catch (error) {
        logger.error('Erro ao buscar top CNAEs:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Top products
app.get('/api/dashboard/top-products', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5;
        const filters = {
            origin: req.query.origin || undefined,
            source: req.query.source || undefined,
            campaign: req.query.campaign || undefined,
            stage: req.query.stage || undefined,
            cnae: req.query.cnae || undefined,
            product: req.query.product || undefined,
            state: req.query.state || undefined,
            city: req.query.city || undefined,
            start_date: req.query.start_date || undefined,
            end_date: req.query.end_date || undefined
        };
        const topProducts = await databaseService.getTopProducts(limit, filters);
        res.json(topProducts);
    } catch (error) {
        logger.error('Erro ao buscar top produtos:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Geographic distribution
app.get('/api/dashboard/geographic', async (req, res) => {
    try {
        const filters = {
            origin: req.query.origin || undefined,
            source: req.query.source || undefined,
            campaign: req.query.campaign || undefined,
            stage: req.query.stage || undefined,
            cnae: req.query.cnae || undefined,
            product: req.query.product || undefined,
            state: req.query.state || undefined,
            city: req.query.city || undefined,
            start_date: req.query.start_date || undefined,
            end_date: req.query.end_date || undefined
        };
        const distribution = await databaseService.getGeographicDistribution(filters);
        res.json(distribution);
    } catch (error) {
        logger.error('Erro ao buscar distribuição geográfica:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// Funnel data
app.get('/api/dashboard/funnel', async (req, res) => {
    try {
        const filters = {
            origin: req.query.origin || undefined,
            source: req.query.source || undefined,
            campaign: req.query.campaign || undefined,
            stage: req.query.stage || undefined,
            cnae: req.query.cnae || undefined,
            product: req.query.product || undefined,
            state: req.query.state || undefined,
            city: req.query.city || undefined,
            start_date: req.query.start_date || undefined,
            end_date: req.query.end_date || undefined
        };
        const funnelData = await databaseService.getFunnelData(filters);
        res.json(funnelData);
    } catch (error) {
        logger.error('Erro ao buscar dados do funil:', error);
        res.status(500).json({ error: 'Erro interno' });
    }
});

// --- WhatsApp Integration Endpoints ---

// Get connection status
app.get('/api/whatsapp/status', (req, res) => {
    res.json(whatsappService.getStatus());
});

// Disconnect
app.post('/api/whatsapp/disconnect', async (req, res) => {
    try {
        await whatsappService.disconnect();
        res.json({ success: true });
    } catch (error) {
        logger.error('Erro ao desconectar WhatsApp:', error);
        res.status(500).json({ error: 'Erro ao desconectar' });
    }
});

// --- CSV Export Endpoint ---
app.get('/api/export/leads', async (req, res) => {
    try {
        const filters = {
            origin: req.query.origin || undefined,
            source: req.query.source || undefined,
            campaign: req.query.campaign || undefined,
            stage: req.query.stage || undefined,
            start_date: req.query.start_date || undefined,
            end_date: req.query.end_date || undefined
        };
        const leads = await databaseService.getLeadsByFilter(filters);

        // Generate CSV
        const headers = ['Nome', 'Telefone', 'Email', 'CNPJ', 'Cidade', 'UF', 'CNAE', 'Score', 'Temperatura', 'Status', 'Origem', 'Fonte', 'Campanha', 'Data'];
        const csvRows = [headers.join(',')];

        leads.forEach(lead => {
            const row = [
                `"${(lead.name || '').replace(/"/g, '""')}"`,
                lead.phone || '',
                lead.email || '',
                lead.cnpj || '',
                `"${(lead.city || '').replace(/"/g, '""')}"`,
                lead.state || '',
                lead.cnae_code || '',
                lead.lead_score || '',
                lead.temperature || '',
                lead.stage || '',
                lead.origin || '',
                lead.source || '',
                `"${(lead.campaign || '').replace(/"/g, '""')}"`,
                lead.created_at ? new Date(lead.created_at).toLocaleDateString('pt-BR') : ''
            ];
            csvRows.push(row.join(','));
        });

        const csv = csvRows.join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=leads_${new Date().toISOString().split('T')[0]}.csv`);
        res.send('\uFEFF' + csv); // BOM for Excel UTF-8 compatibility
    } catch (error) {
        logger.error('Erro ao exportar leads:', error);
        res.status(500).json({ error: 'Erro ao exportar' });
    }
});

// --- Conversation History Endpoint ---
app.get('/api/conversation/:phone', async (req, res) => {
    try {
        const phone = req.params.phone;
        const history = await databaseService.getConversationHistory(phone);
        res.json({ success: true, history });
    } catch (error) {
        logger.error('Erro ao buscar histórico:', error);
        res.status(500).json({ error: 'Erro ao buscar histórico' });
    }
});

// QR Code Stream (SSE)
app.get('/api/whatsapp/qr', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendQR = async (qr) => {
        try {
            const url = await QRCode.toDataURL(qr);
            res.write(`data: ${url}\n\n`);
        } catch (err) {
            logger.error('Erro ao gerar QR Code:', err);
        }
    };

    // Registra callback
    whatsappService.setQRCallback(sendQR);

    // Se não estiver conectado, força geração de novo QR
    if (!whatsappService.isConnected()) {
        whatsappService.initialize().catch(console.error);
    }

    req.on('close', () => {
        whatsappService.setQRCallback(null);
    });
});

// WebSocket connection handler
io.on('connection', (socket) => {
    logger.info('📡 Cliente conectado ao WebSocket');

    socket.on('disconnect', () => {
        logger.info('📡 Cliente desconectado do WebSocket');
    });
});

// Start server and initialize services
server.listen(PORT, async () => {
    logger.info(`🚀 Servidor rodando na porta ${PORT}`);
    logger.info(`📊 Dashboard: http://localhost:${PORT}`);
    logger.info(`🔌 Webhook endpoint: http://localhost:${PORT}/webhook/lead`);
    logger.info(`📡 WebSocket: ws://localhost:${PORT}`);

    try {
        // 1. Initialize Database
        logger.info('📦 Inicializando banco de dados...');
        await databaseService.init();

        // 2. Load Knowledge Base
        logger.info('📚 Carregando Base de Conhecimento...');
        await knowledgeBaseService.loadKnowledgeBase();

        // 3. Initialize WhatsApp (Márcia)
        logger.info('🤖 Inicializando Márcia (WhatsApp Agent)...');
        await whatsappService.initialize();

        logger.info(`✅ RD Station configurado: ${rdStationService.isConfigured() ? 'SIM' : 'NÃO (modo teste)'}`);

    } catch (error) {
        logger.error('❌ Erro fatal na inicialização:', error);
    }
});
