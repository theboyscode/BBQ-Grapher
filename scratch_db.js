const db = require('./backend/db');

setTimeout(() => {
    db.getHistory(10, (err, rows) => {
        console.log("DB Rows:", rows);
        process.exit(0);
    });
}, 6000);
