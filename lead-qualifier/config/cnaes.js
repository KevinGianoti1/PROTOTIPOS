/**
 * Lista de CNAEs que compõem o Perfil de Cliente Ideal (PCI)
 * Estes CNAEs são aceitos como leads qualificados
 */

const CNAES_PERMITIDOS = [
    '4744001', // Comércio varejista de ferragens e ferramentas
    '4744099', // Comércio varejista de materiais de construção em geral
    '4672900', // Comércio atacadista de ferragens e ferramentas
    '4742300', // Comércio varejista de material elétrico
    '4679699', // Comércio atacadista de materiais de construção em geral
    '4673700', // Comércio atacadista de material elétrico
    '4663000', // Comércio atacadista de Máquinas e equipamentos para uso industrial; partes e peças
    '4744003', // Comércio varejista de materiais hidráulicos
    '4744005', // Comércio varejista de materiais de construção não especificados anteriormente
    '4789099', // Comércio varejista de outros produtos não especificados anteriormente
    '4642702', // Comércio atacadista de roupas e acessórios para uso profissional e de segurança do trabalho
    '4755502', // Comércio varejista de artigos de armarinho
    '4679601', // Comércio atacadista de tintas, vernizes e similares
    '7739099', // Aluguel de outras máquinas e equipamentos comerciais e industriais não especificados anteriormente, sem operador
    '4759899', // Comércio varejista de outros artigos de uso pessoal e doméstico não especificados anteriormente
    '4741500', // Comércio varejista de tintas e materiais para pintura
    '4661300', // Comércio atacadista de máquinas, aparelhos e equipamentos para uso agropecuário; partes e peças
    '4662100', // Comércio atacadista de máquinas, equipamentos para terraplenagem, mineração e construção; partes e peças
    '4679604', // Comércio atacadista especializado de materiais de construção não especificados anteriormente
    '4669999', // Comércio atacadista de outras máquinas e equipamentos não especificados anteriormente; partes e peças
    '7319002', // Promoção de vendas
    '4613300'  // Representantes comerciais e agentes do comércio de madeira, material de construção e ferragens
];

/**
 * Mapa de CNAEs com descrições (para logs e interface)
 */
const CNAES_DESCRICOES = {
    '4744001': 'Comércio varejista de ferragens e ferramentas',
    '4744099': 'Comércio varejista de materiais de construção em geral',
    '4672900': 'Comércio atacadista de ferragens e ferramentas',
    '4742300': 'Comércio varejista de material elétrico',
    '4679699': 'Comércio atacadista de materiais de construção em geral',
    '4673700': 'Comércio atacadista de material elétrico',
    '4663000': 'Comércio atacadista de Máquinas e equipamentos para uso industrial; partes e peças',
    '4744003': 'Comércio varejista de materiais hidráulicos',
    '4744005': 'Comércio varejista de materiais de construção não especificados anteriormente',
    '4789099': 'Comércio varejista de outros produtos não especificados anteriormente',
    '4642702': 'Comércio atacadista de roupas e acessórios para uso profissional e de segurança do trabalho',
    '4755502': 'Comércio varejista de artigos de armarinho',
    '4679601': 'Comércio atacadista de tintas, vernizes e similares',
    '7739099': 'Aluguel de outras máquinas e equipamentos comerciais e industriais não especificados anteriormente, sem operador',
    '4759899': 'Comércio varejista de outros artigos de uso pessoal e doméstico não especificados anteriormente',
    '4741500': 'Comércio varejista de tintas e materiais para pintura',
    '4661300': 'Comércio atacadista de máquinas, aparelhos e equipamentos para uso agropecuário; partes e peças',
    '4662100': 'Comércio atacadista de máquinas, equipamentos para terraplenagem, mineração e construção; partes e peças',
    '4679604': 'Comércio atacadista especializado de materiais de construção não especificados anteriormente',
    '4669999': 'Comércio atacadista de outras máquinas e equipamentos não especificados anteriormente; partes e peças',
    '7319002': 'Promoção de vendas',
    '4613300': 'Representantes comerciais e agentes do comércio de madeira, material de construção e ferragens'
};

module.exports = {
    CNAES_PERMITIDOS,
    CNAES_DESCRICOES
};
