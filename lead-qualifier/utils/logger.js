/**
 * Sistema simples de logging
 */

const LOG_LEVELS = {
    ERROR: 'ERROR',
    INFO: 'INFO',
    DEBUG: 'DEBUG'
};

class Logger {
    constructor() {
        this.level = process.env.LOG_LEVEL || 'info';
    }

    formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logData = data ? JSON.stringify(data, null, 2) : '';
        return `[${timestamp}] [${level}] ${message} ${logData}`;
    }

    error(message, data = null) {
        console.error(this.formatMessage(LOG_LEVELS.ERROR, message, data));
    }

    info(message, data = null) {
        console.log(this.formatMessage(LOG_LEVELS.INFO, message, data));
    }

    debug(message, data = null) {
        if (this.level === 'debug') {
            console.log(this.formatMessage(LOG_LEVELS.DEBUG, message, data));
        }
    }
}

module.exports = new Logger();
