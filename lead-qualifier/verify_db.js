const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

console.log('=== VERIFICANDO ESTRUTURA DO BANCO ===\n');

// Verificar coluna conversation_id em messages
db.all("PRAGMA table_info(messages)", (err, rows) => {
    if (err) {
        console.error('Erro ao verificar messages:', err);
        return;
    }
    console.log('📁 Estrutura da tabela MESSAGES:');
    const hasConversationId = rows.find(r => r.name === 'conversation_id');
    if (hasConversationId) {
        console.log('✅ Coluna conversation_id EXISTE');
    } else {
        console.log('❌ Coluna conversation_id NÃO EXISTE');
    }
    console.log();
});

// Verificar coluna current_conversation_id em contacts
db.all("PRAGMA table_info(contacts)", (err, rows) => {
    if (err) {
        console.error('Erro ao verificar contacts:', err);
        return;
    }
    console.log('📁 Estrutura da tabela CONTACTS:');
    const hasCurrentConvId = rows.find(r => r.name === 'current_conversation_id');
    if (hasCurrentConvId) {
        console.log('✅ Coluna current_conversation_id EXISTE');
    } else {
        console.log('❌ Coluna current_conversation_id NÃO EXISTE');
    }
    console.log();

    // Verificar se há contatos com sessões
    db.all("SELECT phone, name, current_conversation_id, origin FROM contacts LIMIT 5", (err, contacts) => {
        if (err) {
            console.error('Erro:', err);
            db.close();
            return;
        }

        console.log('=== AMOSTRA DE CONTATOS ===');
        if (contacts.length === 0) {
            console.log('Nenhum contato encontrado no banco.');
        } else {
            contacts.forEach(c => {
                console.log(`📞 ${c.phone} | Nome: ${c.name || 'N/A'} | Sessão: ${c.current_conversation_id || 'N/A'} | Origem: ${c.origin || 'N/A'}`);
            });
        }
        console.log();

        // Verificar sessões de conversa
        db.all("SELECT DISTINCT conversation_id FROM messages WHERE conversation_id IS NOT NULL LIMIT 10", (err, sessions) => {
            if (err) {
                console.error('Erro:', err);
                db.close();
                return;
            }

            console.log('=== SESSÕES DE CONVERSA ===');
            if (sessions.length === 0) {
                console.log('Nenhuma sessão encontrada.');
            } else {
                console.log(`✅ ${sessions.length} sessões diferentes encontradas:`);
                sessions.forEach(s => console.log(`  - ${s.conversation_id}`));
            }

            db.close();
            console.log('\n✅ Verificação completa!');
        });
    });
});
