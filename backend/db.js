const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'bbq_data.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    db.run(`CREATE TABLE IF NOT EXISTS temperatures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      meatTemp REAL,
      smokerTemp REAL,
      probe3 REAL,
      probe4 REAL,
      battery REAL
    )`, (err) => {
      if (err) console.error('Error creating table', err);
      else {
        // Automatically add new columns if they don't exist (for backwards compatibility)
        db.run('ALTER TABLE temperatures ADD COLUMN probe3 REAL', () => {});
        db.run('ALTER TABLE temperatures ADD COLUMN probe4 REAL', () => {});
        db.run('ALTER TABLE temperatures ADD COLUMN battery REAL', () => {});
      }
    });
  }
});

function insertTemperature(meatTemp, smokerTemp, probe3, probe4, battery, callback) {
  const sql = `INSERT INTO temperatures (meatTemp, smokerTemp, probe3, probe4, battery) VALUES (?, ?, ?, ?, ?)`;
  db.run(sql, [meatTemp, smokerTemp, probe3, probe4, battery], function(err) {
    if (callback) callback(err, this.lastID);
  });
}

function getHistory(limit = 1000, callback) {
  const sql = `SELECT * FROM (SELECT * FROM temperatures ORDER BY timestamp DESC LIMIT ?) ORDER BY timestamp ASC`;
  db.all(sql, [limit], (err, rows) => {
    if (callback) callback(err, rows);
  });
}

// Get the latest temperature to only update one column if the other arrives separately
function getLatest(callback) {
    const sql = `SELECT * FROM temperatures ORDER BY timestamp DESC LIMIT 1`;
    db.get(sql, [], (err, row) => {
        if (callback) callback(err, row);
    });
}

module.exports = {
  db,
  insertTemperature,
  getHistory,
  getLatest
};
