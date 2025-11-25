const knowledgeBaseService = require('./services/knowledgeBaseService');
const logger = require('./utils/logger');
const path = require('path');

async function test() {
    console.log('--- Iniciando Teste do RAG ---');

    const expectedPath = path.join(__dirname, 'knowledge_base/catalogo.pdf');
    console.log('Caminho esperado:', expectedPath);

    // Tenta carregar a base
    await knowledgeBaseService.loadKnowledgeBase();

    if (knowledgeBaseService.isLoaded) {
        console.log('✅ Base carregada com sucesso!');

        // Pega um contexto de exemplo
        const context = knowledgeBaseService.getContext('disco de corte');

        console.log('\n--- Amostra do Texto Extraído (primeiros 500 chars) ---');
        console.log(context.substring(0, 500));
        console.log('...\n---------------------------------------------------');

        console.log(`Tamanho total do texto: ${context.length} caracteres`);
    } else {
        console.error('❌ Falha ao carregar a base. Verifique os logs acima.');
    }
}

test();
