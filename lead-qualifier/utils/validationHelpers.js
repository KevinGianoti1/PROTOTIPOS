/**
 * Formata número de telefone brasileiro
 * @param {string} phoneNumber - Número apenas com dígitos
 * @returns {string} - Número formatado
 */
function formatPhoneNumber(phoneNumber) {
    // Remove tudo que não é dígito
    const digits = phoneNumber.replace(/\D/g, '');

    // Se tem 13 dígitos (55 + DDD + número)
    if (digits.length === 13) {
        const country = digits.substring(0, 2);
        const ddd = digits.substring(2, 4);
        const firstPart = digits.substring(4, 9);
        const secondPart = digits.substring(9, 13);
        return `+${country} (${ddd}) ${firstPart}-${secondPart}`;
    }

    // Se tem 11 dígitos (DDD + número)
    if (digits.length === 11) {
        const ddd = digits.substring(0, 2);
        const firstPart = digits.substring(2, 7);
        const secondPart = digits.substring(7, 11);
        return `(${ddd}) ${firstPart}-${secondPart}`;
    }

    // Se tem 10 dígitos (DDD + número fixo)
    if (digits.length === 10) {
        const ddd = digits.substring(0, 2);
        const firstPart = digits.substring(2, 6);
        const secondPart = digits.substring(6, 10);
        return `(${ddd}) ${firstPart}-${secondPart}`;
    }

    // Retorna original se não conseguir formatar
    return phoneNumber;
}

/**
 * Valida CNPJ usando algoritmo de dígitos verificadores
 * @param {string} cnpj - CNPJ com ou sem formatação
 * @returns {boolean} - true se válido
 */
function validateCNPJ(cnpj) {
    // Remove formatação
    cnpj = cnpj.replace(/\D/g, '');

    // Verifica se tem 14 dígitos
    if (cnpj.length !== 14) return false;

    // Verifica se todos os dígitos são iguais (ex: 11111111111111)
    if (/^(\d)\1+$/.test(cnpj)) return false;

    // Validação do primeiro dígito verificador
    let sum = 0;
    let weight = 5;
    for (let i = 0; i < 12; i++) {
        sum += parseInt(cnpj[i]) * weight;
        weight = weight === 2 ? 9 : weight - 1;
    }
    let digit1 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (parseInt(cnpj[12]) !== digit1) return false;

    // Validação do segundo dígito verificador
    sum = 0;
    weight = 6;
    for (let i = 0; i < 13; i++) {
        sum += parseInt(cnpj[i]) * weight;
        weight = weight === 2 ? 9 : weight - 1;
    }
    let digit2 = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (parseInt(cnpj[13]) !== digit2) return false;

    return true;
}

/**
 * Valida e-mail
 * @param {string} email
 * @returns {boolean}
 */
function validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

module.exports = {
    formatPhoneNumber,
    validateCNPJ,
    validateEmail
};
