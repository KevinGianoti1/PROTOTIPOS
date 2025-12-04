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
        this.messageTimers = {}; // Para debouncing de mensagens
        this.messageBuffers = {}; // Buffer de mensagens recentes por contato (sliding window)

        // Reconnection settings
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000; // Start with 5 seconds
        this.isReconnecting = false;

        // Rate limiting settings
        this.messageRates = {}; // { phone: { count, firstMessageTime } }
        this.maxMessagesPerMinute = 10;
        this.blockedContacts = {}; // { phone: unblockTime }
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
            if (this.client) {
                logger.info('⚠️ Cliente anterior detectado. Destruindo para reiniciar...');
                try {
                    await this.client.destroy();
                } catch (e) {
                    logger.warn('Erro ao destruir cliente anterior:', e);
                }
                this.client = null;
                this.isReady = false;
            }

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
            this.client.on('disconnected', async (reason) => {
                this.isReady = false;
                logger.warn('⚠️ WhatsApp desconectado:', reason);

                // Auto-reconnect logic
                if (!this.isReconnecting && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.isReconnecting = true;
                    this.reconnectAttempts++;
                    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff

                    logger.info(`🔄 Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts} em ${delay / 1000}s...`);

                    setTimeout(async () => {
                        try {
                            await this.initialize();
                            this.reconnectAttempts = 0; // Reset on success
                            logger.info('✅ Reconexão bem-sucedida!');
                        } catch (err) {
                            logger.error('❌ Falha na reconexão:', err.message);
                        } finally {
                            this.isReconnecting = false;
                        }
                    }, delay);
                } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    logger.error('❌ Máximo de tentativas de reconexão atingido. Reinicie manualmente.');
                }
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

            // Sanitiza o número (remove sufixos como @c.us, @lid e mantém apenas dígitos)
            const phoneNumber = message.from.replace(/\D/g, '');

            // Inicializa buffer para este contato se não existir
            if (!this.messageBuffers[phoneNumber]) {
                this.messageBuffers[phoneNumber] = [];
            }

            // Adiciona mensagem ao buffer (mantém últimas 3 mensagens)
            this.messageBuffers[phoneNumber].push({
                content: message.body,
                timestamp: Date.now()
            });

            // Mantém apenas as últimas 3 mensagens (sliding window)
            if (this.messageBuffers[phoneNumber].length > 3) {
                this.messageBuffers[phoneNumber].shift();
            }

            // DEBOUNCING: Aguarda 3 segundos para permitir múltiplas mensagens do usuário
            if (this.messageTimers[phoneNumber]) {
                clearTimeout(this.messageTimers[phoneNumber]);
            }

            this.messageTimers[phoneNumber] = setTimeout(async () => {
                await this.processUserMessage(phoneNumber, message);
                delete this.messageTimers[phoneNumber];
                // Limpa buffer após processar
                this.messageBuffers[phoneNumber] = [];
            }, 3000);

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
     * Processa o lote de mensagens do usuário (após debounce)
     * @param {string} phoneNumber 
     * @param {Object} lastMessage - Último objeto de mensagem recebido (para responder ao correto)
     */
    async processUserMessage(phoneNumber, lastMessage) {
        try {
            // Recupera mensagens do buffer
            const buffer = this.messageBuffers[phoneNumber] || [];
            if (buffer.length === 0) return;

            // Combina as mensagens em uma única string
            // Ordena por timestamp garantindo a ordem cronológica
            const sortedMessages = buffer.sort((a, b) => a.timestamp - b.timestamp);
            const combinedText = sortedMessages.map(m => m.content).join(' ').trim(); // Usa espaço para juntar frases picadas

            logger.info(`📨 Processando lote de ${buffer.length} mensagens de ${phoneNumber}`);
            logger.info(`   Texto combinado: "${combinedText}"`);

            let messageContent = combinedText;

            // Lógica de Áudio (Se a última mensagem for áudio)
            // Nota: O buffer atual foca em texto. Se houver áudio, processamos o áudio da última mensagem.
            if (lastMessage.hasMedia) {
                try {
                    const media = await lastMessage.downloadMedia();
                    if (media && media.mimetype.includes('audio')) {
                        logger.info('🎤 Áudio recebido, baixando...');

                        // Garante que a pasta temp existe
                        const tempDir = path.join(__dirname, '../temp');
                        if (!fs.existsSync(tempDir)) {
                            fs.mkdirSync(tempDir);
                        }

                        // Salva arquivo temporário
                        const fileName = `audio_${phoneNumber}_${Date.now()}.ogg`;
                        const filePath = path.join(tempDir, fileName);

                        fs.writeFileSync(filePath, media.data, 'base64');

                        // Envia feedback
                        await lastMessage.reply('(Ouvindo seu áudio...) 🎧');

                        // Transcreve
                        const transcription = await marciaAgentService.transcribeAudio(filePath);

                        // Se tiver texto combinado + áudio, junta os dois
                        messageContent = messageContent ? `${messageContent} [Transcrição: ${transcription}]` : transcription;

                        // Limpa arquivo
                        fs.unlinkSync(filePath);

                        await databaseService.updateContact(phoneNumber, { audio_recebido: true });
                    }
                } catch (audioError) {
                    logger.error('Erro ao processar áudio:', audioError);
                    await lastMessage.reply('Tive um problema para ouvir seu áudio 😔 Pode escrever?');
                }
            }

            // Se não tiver conteúdo (ex: imagem sem legenda e sem áudio), ignora
            if (!messageContent) return;

            // Incrementa contador de mensagens
            const contact = await databaseService.getContact(phoneNumber);
            if (contact) {
                await databaseService.updateContact(phoneNumber, {
                    total_mensagens: (contact.total_mensagens || 0) + 1
                });
            }

            // Envia para o agente Márcia processar
            let response = await marciaAgentService.processMessage(phoneNumber, messageContent);

            // Remove tag [COMPLETE] e JSON (dados internos)
            if (response && response.includes('[COMPLETE]')) {
                response = response.replace(/\[COMPLETE\]\{[^\}]+\}/g, '').trim();
                logger.info('🎯 Tag [COMPLETE] removida da resposta');
            }

            // Verifica se deve enviar catálogo
            if (response && response.includes('[SEND_CATALOG]')) {
                logger.info('📂 Detectado pedido de catálogo');
                response = response.replace(/\[SEND_CATALOG\]/g, '').trim();

                // Envia a resposta de texto primeiro
                if (response) {
                    await lastMessage.reply(response);
                }

                // Verifica se a resposta já contém o link do catálogo (para evitar duplicidade)
                if (!response.includes('drive.google.com')) {
                    // Envia o link do Google Drive apenas se não estiver na mensagem
                    const catalogMessage = '📘 *Catálogo Maxi Force*\n\n' +
                        'Aqui está nosso catálogo completo de produtos:\n' +
                        'https://drive.google.com/file/d/1SrZblBiGp6qjdRh9OVnoybwgRVQpJezj/view?usp=sharing\n\n' +
                        'Qualquer dúvida, estou à disposição! 😊';

                    await lastMessage.reply(catalogMessage);
                }

                await databaseService.updateContact(phoneNumber, { catalogo_enviado: true });
            } else if (response) {
                await lastMessage.reply(response);
                logger.info(`📤 Resposta enviada para ${phoneNumber}`);
            }

        } catch (error) {
            logger.error('❌ Erro no processUserMessage:', error);
            await lastMessage.reply('Ops! Tive um probleminha aqui 😅 Pode repetir?');
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
            logger.info(`📂 Tentando enviar arquivo para ${phoneNumber}`);
            logger.info(`   Caminho: ${filePath}`);

            if (!fs.existsSync(filePath)) {
                throw new Error(`Arquivo não encontrado: ${filePath}`);
            }

            // Lê o arquivo e converte para base64
            const fileData = fs.readFileSync(filePath, { encoding: 'base64' });
            const mimeType = 'application/pdf';
            const fileName = path.basename(filePath);

            const media = new MessageMedia(mimeType, fileData, fileName);
            const chatId = `${phoneNumber}@c.us`;

            logger.info('   Mídia criada (Base64), enviando...');
            await this.client.sendMessage(chatId, media, { caption });

            logger.info(`✅ Arquivo enviado: ${fileName}`);
        } catch (error) {
            logger.error(`❌ Erro ao enviar arquivo:`, error);
            if (error.message) logger.error('   Mensagem:', error.message);
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
