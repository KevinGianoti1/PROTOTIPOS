/**
 * Filtro de conteúdo para detectar palavrões e linguagem inapropriada
 */

const PROHIBITED_WORDS = [
    // Lista básica de palavras proibidas em português
    // Adicione mais conforme necessário
    'porra', 'merda', 'caralho', 'puta', 'fdp', 'vsf',
    'cu', 'buceta', 'cacete', 'desgraça', 'inferno'
];

/**
 * Verifica se a mensagem contém palavrões
 * @param {string} message
 * @returns {boolean}
 */
function containsProfanity(message) {
    const lowerMessage = message.toLowerCase();

    return PROHIBITED_WORDS.some(word => {
        // Verifica palavra completa (com bordas de palavra)
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        return regex.test(lowerMessage);
    });
}

/**
 * Verifica se a mensagem parece conter dados sensíveis
 * @param {string} message
 * @returns {object} { hasSensitiveData: boolean, type: string }
 */
function containsSensitiveData(message) {
    // Padrão de cartão de crédito (16 dígitos)
    if (/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(message)) {
        return { hasSensitiveData: true, type: 'credit_card' };
    }

    // Padrão de senha (palavras como "senha:", "password:")
    if (/\b(senha|password|pass)\s*[:=]\s*\S+/i.test(message)) {
        return { hasSensitiveData: true, type: 'password' };
    }

    return { hasSensitiveData: false, type: null };
}

module.exports = {
    containsProfanity,
    containsSensitiveData,
    PROHIBITED_WORDS
};
