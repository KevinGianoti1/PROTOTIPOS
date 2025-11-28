/**
 * Normaliza a origem usando sinônimos
 * @param {string} origin 
 * @returns {string}
 */
function normalizeOrigin(origin) {
    if (!origin) return origin;

    const normalized = origin.toLowerCase().trim();

    // Sinônimos para Instagram
    if (/\b(insta|instagram|ig|anuncio|anúncio|propaganda|post|story|stories|rede social|redes sociais)\b/i.test(normalized)) {
        return 'Instagram';
    }

    // Sinônimos para Site
    if (/\b(site|google|pesquisa|busca|navegador|internet|web)\b/i.test(normalized)) {
        return 'Site';
    }

    // Sinônimos para Indicação
    if (/\b(indicacao|indicação|indicaram|amigo|conhecido|parceiro|recomendacao|recomendação)\b/i.test(normalized)) {
        return 'Indicação';
    }

    // Sinônimos para WhatsApp (apenas se explicitamente mencionado)
    if (/\b(whatsapp|whats|wpp|zap|número|numero)\b/i.test(normalized)) {
        return 'WhatsApp';
    }

    // Retorna o valor original capitalizado se não encontrar sinônimo
    return origin.charAt(0).toUpperCase() + origin.slice(1).toLowerCase();
}

module.exports = { normalizeOrigin };
