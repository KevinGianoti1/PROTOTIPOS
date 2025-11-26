const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function debugDB() {
    const dbPath = path.join(__dirname, 'database.sqlite');
    console.log('Opening DB at:', dbPath);
    const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    const count = await db.get('SELECT COUNT(*) as c FROM contacts');
    console.log('Total contacts:', count.c);

    const rows = await db.all('SELECT phone, created_at FROM contacts LIMIT 5');
    console.log('Sample rows:', rows);

    // Test the query used in getDashboardStats
    const statsQuery = "SELECT COUNT(*) as count FROM contacts WHERE 1=1";
    const stats = await db.get(statsQuery);
    console.log('Stats query result:', stats);
}

debugDB();
