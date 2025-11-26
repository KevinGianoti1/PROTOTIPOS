const fs = require('fs');
const path = require('path');

class AuditLogger {
    constructor() {
        this.logsDir = path.join(__dirname, '../logs/audit');
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }

    getLogFileName() {
        const date = new Date().toISOString().split('T')[0];
        return path.join(this.logsDir, `audit-${date}.log`);
    }

    log(event) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            ...event
        };

        const logLine = JSON.stringify(logEntry) + '\n';
        const logFile = this.getLogFileName();

        try {
            fs.appendFileSync(logFile, logLine);
        } catch (error) {
            console.error('Erro ao salvar log de auditoria:', error);
        }
    }

    logMessage(phoneNumber, role, content, extractedData = null) {
        this.log({
            type: 'message',
            phoneNumber,
            role,
            content: content.substring(0, 500), // Limita tamanho
            extractedData
        });
    }

    logValidation(phoneNumber, field, value, isValid, reason = null) {
        this.log({
            type: 'validation',
            phoneNumber,
            field,
            value,
            isValid,
            reason
        });
    }

    logError(phoneNumber, error, context = null) {
        this.log({
            type: 'error',
            phoneNumber,
            error: error.message,
            stack: error.stack,
            context
        });
    }

    logRateLimit(phoneNumber, messageCount) {
        this.log({
            type: 'rate_limit',
            phoneNumber,
            messageCount
        });
    }

    logBlock(phoneNumber, reason, duration) {
        this.log({
            type: 'block',
            phoneNumber,
            reason,
            duration
        });
    }

    logCRMSync(phoneNumber, success, dealId = null, error = null) {
        this.log({
            type: 'crm_sync',
            phoneNumber,
            success,
            dealId,
            error
        });
    }
}

module.exports = new AuditLogger();
