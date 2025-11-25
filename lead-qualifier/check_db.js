const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function checkDB() {
    const db = await open({
        filename: path.join(__dirname, 'database.sqlite'),
        driver: sqlite3.Database
    });

    const rows = await db.all('SELECT origin, COUNT(*) as c FROM contacts GROUP BY origin');
    console.log('Distribution:', rows);
}

checkDB();
