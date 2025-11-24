require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const cnpjService = require('./services/cnpjService');
const validationService = require('./services/validationService');
const rdStationService = require('./services/rdStationService');
const whatsappService = require('./services/whatsappService');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Rota principal - serve a interface de teste
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota de health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        rdStationConfigured: rdStationService.isConfigured(),
        timestamp: new Date().toISOString()
    });
});

// Endpoint principal - recebe dados do formulário/webhook
app.post('/webhook/lead', async (req, res) => {
    try {
        const { cnpj, nome, telefone, origem } = req.body;

        // Validação básica
        if (!cnpj || !nome || !telefone) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatórios: cnpj, nome, telefone'
            });
        }

        logger.info('Novo lead recebido', { cnpj, nome, origem: origem || 'não informado' });

        // Processa o lead (consulta CNPJ + valida PCI)
        const resultado = await validationService.processarLead(
            { cnpj, nome, telefone, origem: origem || 'Teste' },
            cnpjService
        );

        // Tenta integrar com RD Station (se configurado)
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

        // Retorna resultado completo
        res.json({
            success: true,
            resultado: {
                lead: resultado.lead,
                empresa: resultado.empresa,
                validacao: resultado.validacao,
                rdStation: rdStationResult
            }
        });

    } catch (error) {
        logger.error('Erro ao processar lead', { error: error.message });
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Endpoint para listar CNAEs permitidos
app.get('/api/cnaes-permitidos', (req, res) => {
    const cnaes = validationService.getCNAEsPermitidos();
    res.json({
        success: true,
        total: cnaes.length,
        cnaes: cnaes
    });
});

// Inicia o servidor
app.listen(PORT, async () => {
    logger.info(`🚀 Servidor rodando na porta ${PORT}`);
    logger.info(`📊 Interface de teste: http://localhost:${PORT}`);
    logger.info(`🔌 Webhook endpoint: http://localhost:${PORT}/webhook/lead`);
    logger.info(`✅ RD Station configurado: ${rdStationService.isConfigured() ? 'SIM' : 'NÃO (modo teste)'}`);

    // Inicializa WhatsApp (Márcia)
    try {
        logger.info('🤖 Inicializando Márcia (WhatsApp Agent)...');
        await whatsappService.initialize();
    } catch (error) {
        logger.error('❌ Erro ao inicializar WhatsApp:', error.message);
        logger.warn('⚠️ Servidor continuará sem WhatsApp. Configure OPENAI_API_KEY no .env para ativar.');
    }
});
