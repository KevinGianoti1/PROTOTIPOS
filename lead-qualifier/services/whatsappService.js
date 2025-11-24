require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const logger = require('../utils/logger');
const marciaAgentService = require('./marciaAgentService');

/**
 * Serviço de integração com WhatsApp (API não oficial)
 * Usa whatsapp-web.js para conectar via WhatsApp Web
 */

class WhatsAppService {
    constructor() {
        this.client = null;
        this.isReady = false;
    }

    /**
     * Inicializa o cliente WhatsApp
     */
    async initialize() {
        try {
            logger.info('🔄 Inicializando WhatsApp...');

            this.client = new Client({
                authStrategy: new LocalAuth({
                    dataPath: './.wwebjs_auth'
                }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--disable-gpu'
                    ]
                }
            });

            // Evento: QR Code (para conectar pela primeira vez)
            this.client.on('qr', (qr) => {
                logger.info('📱 Escaneie o QR Code abaixo com o WhatsApp:');
                qrcode.generate(qr, { small: true });
            });

            // Evento: Autenticado
            this.client.on('authenticated', () => {
                logger.info('✅ WhatsApp autenticado com sucesso!');
            });

            // Evento: Pronto para uso
            this.client.on('ready', () => {
                this.isReady = true;
                logger.info('🚀 WhatsApp conectado e pronto para receber mensagens!');
            });

            // Evento: Mensagem recebida
            this.client.on('message', async (message) => {
                await this.handleMessage(message);
            });

            // Evento: Desconectado
            this.client.on('disconnected', (reason) => {
                this.isReady = false;
                logger.warn('⚠️ WhatsApp desconectado:', reason);
            });

            // Inicializa o cliente
            await this.client.initialize();

        } catch (error) {
            logger.error('❌ Erro ao inicializar WhatsApp:', error);
            throw error;
        }
    }

    /**
     * Processa mensagens recebidas
     * @param {Object} message - Mensagem do WhatsApp
     */
    async handleMessage(message) {
        try {
            // Ignora mensagens de grupos e status
            if (message.from.includes('@g.us') || message.from === 'status@broadcast') {
                return;
            }

            // Ignora mensagens enviadas por nós mesmos
            if (message.fromMe) {
                return;
            }

            const phoneNumber = message.from.replace('@c.us', '');
            const messageText = message.body;

            logger.info(`📩 Mensagem recebida de ${phoneNumber}: "${messageText}"`);

            // Envia para o agente Márcia processar
            const response = await marciaAgentService.processMessage(phoneNumber, messageText);

            // Envia a resposta
            if (response) {
                await message.reply(response);
                logger.info(`📤 Resposta enviada para ${phoneNumber}`);
            }

        } catch (error) {
            logger.error('❌ Erro ao processar mensagem:', error);

            // Envia mensagem de erro genérica
            try {
                await message.reply(
                    'Ops! Tive um probleminha aqui 😅 Pode tentar de novo em alguns segundos?'
                );
            } catch (replyError) {
                logger.error('❌ Erro ao enviar mensagem de erro:', replyError);
            }
        }
    }

    /**
     * Envia mensagem para um número
     * @param {string} phoneNumber - Número com DDI (ex: 5511999999999)
     * @param {string} message - Mensagem a enviar
     */
    async sendMessage(phoneNumber, message) {
        if (!this.isReady) {
            throw new Error('WhatsApp não está conectado');
        }

        try {
            const chatId = `${phoneNumber}@c.us`;
            await this.client.sendMessage(chatId, message);
            logger.info(`📤 Mensagem enviada para ${phoneNumber}`);
        } catch (error) {
            logger.error(`❌ Erro ao enviar mensagem para ${phoneNumber}:`, error);
            throw error;
        }
    }

    /**
     * Verifica se o WhatsApp está conectado
     */
    isConnected() {
        return this.isReady;
    }
}

module.exports = new WhatsAppService();
