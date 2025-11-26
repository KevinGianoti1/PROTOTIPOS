require('dotenv').config();
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const marciaAgentService = require('./marciaAgentService');
const knowledgeBaseService = require('./knowledgeBaseService');
const databaseService = require('./databaseService');

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
     * Define o callback para receber o QR Code
     * @param {Function} callback 
     */
    setQRCallback(callback) {
        this.qrCallback = callback;
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
                if (this.qrCallback) {
                    this.qrCallback(qr);
                }
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
     * Desconecta o WhatsApp
     */
    async disconnect() {
        if (this.client) {
            await this.client.destroy();
            this.client = null;
            this.isReady = false;
            logger.info('WhatsApp desconectado manualmente.');
        }
    }

    /**
     * Retorna o status da conexão
     */
    getStatus() {
        return {
            connected: this.isReady,
            phoneNumber: this.client && this.client.info ? this.client.info.wid.user : null
        };
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
            let messageContent = message.body;

            logger.info(`📩 Mensagem recebida de ${phoneNumber}: "${message.type}"`);

            // Tratamento de Áudio (PTT - Push to Talk)
            if (message.type === 'ptt' || message.type === 'audio') {
                try {
                    logger.info('🎤 Áudio recebido, baixando...');
                    const media = await message.downloadMedia();

                    if (media) {
                        // Garante que a pasta temp existe
                        const tempDir = path.join(__dirname, '../temp');
                        if (!fs.existsSync(tempDir)) {
                            fs.mkdirSync(tempDir);
                        }

                        // Salva arquivo temporário
                        const fileName = `audio_${phoneNumber}_${Date.now()}.ogg`;
                        const filePath = path.join(tempDir, fileName);

                        fs.writeFileSync(filePath, media.data, 'base64');
                        logger.info('Arquivo de áudio salvo:', filePath);

                        // Envia feedback para o usuário
                        await message.reply('(Ouvindo seu áudio...) 🎧');

                        // Transcreve
                        messageContent = await marciaAgentService.transcribeAudio(filePath);

                        // Remove arquivo temporário
                        fs.unlinkSync(filePath);

                        // Marca que recebeu áudio
                        await databaseService.updateContact(phoneNumber, {
                            audio_recebido: true
                        });
                    }
                } catch (error) {
                    logger.error('Erro ao processar áudio:', error);
                    await message.reply('Tive um problema para ouvir seu áudio 😔 Pode escrever?');
                    return;
                }
            }

            // Incrementa contador de mensagens
            const contact = await databaseService.getContact(phoneNumber);
            if (contact) {
                await databaseService.updateContact(phoneNumber, {
                    total_mensagens: (contact.total_mensagens || 0) + 1
                });
            }

            // Envia para o agente Márcia processar
            let response = await marciaAgentService.processMessage(phoneNumber, messageContent);

            // Verifica se deve enviar catálogo
            if (response && response.includes('[SEND_CATALOG]')) {
                logger.info('📂 Detectado pedido de catálogo');
                response = response.replace('[SEND_CATALOG]', '').trim();

                // Envia a resposta de texto primeiro (sem a tag)
                if (response) {
                    await message.reply(response);
                }

                // Envia o arquivo
                const catalogPath = knowledgeBaseService.getCatalogPath();
                await this.sendFile(phoneNumber, catalogPath, 'Aqui está o nosso catálogo! 📘');

                // Marca que enviou catálogo
                await databaseService.updateContact(phoneNumber, {
                    catalogo_enviado: true
                });
            } else if (response) {
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
     * Envia arquivo para um número
     * @param {string} phoneNumber - Número com DDI
     * @param {string} filePath - Caminho absoluto do arquivo
     * @param {string} caption - Legenda opcional
     */
    async sendFile(phoneNumber, filePath, caption = '') {
        if (!this.isReady) {
            throw new Error('WhatsApp não está conectado');
        }

        try {
            const chatId = `${phoneNumber}@c.us`;
            const media = MessageMedia.fromFilePath(filePath);
            await this.client.sendMessage(chatId, media, { caption });
            logger.info(`📤 Arquivo enviado para ${phoneNumber}: ${filePath}`);
        } catch (error) {
            logger.error(`❌ Erro ao enviar arquivo para ${phoneNumber}:`, error);
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
