const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const fs = require('fs');
const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.resolve(dataDir, 'bbq_data.db');

const addColumnIfNotExists = (tableName, columnName, columnDef) => {
  db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
    if (err) return console.error(`Error checking columns for ${tableName}`, err);
    const exists = columns.some(col => col.name === columnName);
    if (!exists) {
      db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`, (err) => {
        if (err) console.error(`Failed to add ${columnName} to ${tableName}`, err);
        else console.log(`Added column ${columnName} to ${tableName}`);
      });
    }
  });
};

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      target_temp REAL DEFAULT 205,
      notifications_enabled BOOLEAN DEFAULT 1,
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      notes TEXT
    )`, (err) => {
      if (err) console.error('Error creating sessions table', err);
      else {
        addColumnIfNotExists('sessions', 'target_temp', 'REAL DEFAULT 205');
        addColumnIfNotExists('sessions', 'notifications_enabled', 'BOOLEAN DEFAULT 1');
      }
    });

    db.run(`CREATE TABLE IF NOT EXISTS temperatures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      session_id INTEGER,
      meatTemp REAL,
      smokerTemp REAL,
      probe3 REAL,
      probe4 REAL,
      battery REAL,
      FOREIGN KEY(session_id) REFERENCES sessions(id)
    )`, (err) => {
      if (err) console.error('Error creating table', err);
      else {
        addColumnIfNotExists('temperatures', 'probe3', 'REAL');
        addColumnIfNotExists('temperatures', 'probe4', 'REAL');
        addColumnIfNotExists('temperatures', 'battery', 'REAL');
        addColumnIfNotExists('temperatures', 'session_id', 'INTEGER');
      }
    });
  }
});

function insertTemperature(sessionId, meatTemp, smokerTemp, probe3, probe4, battery, callback) {
  const sql = `INSERT INTO temperatures (session_id, meatTemp, smokerTemp, probe3, probe4, battery) VALUES (?, ?, ?, ?, ?, ?)`;
  db.run(sql, [sessionId, meatTemp, smokerTemp, probe3, probe4, battery], function(err) {
    if (callback) callback(err, this.lastID);
  });
}

function getHistory(sessionId, limit = 10000, callback) {
  if (!sessionId) {
    if (callback) callback(null, []);
    return;
  }
  const sql = `SELECT * FROM (SELECT * FROM temperatures WHERE session_id = ? ORDER BY timestamp DESC LIMIT ?) ORDER BY timestamp ASC`;
  db.all(sql, [sessionId, limit], (err, rows) => {
    if (callback) callback(err, rows);
  });
}

function getLatest(callback) {
    const sql = `SELECT * FROM temperatures ORDER BY timestamp DESC LIMIT 1`;
    db.get(sql, [], (err, row) => {
        if (callback) callback(err, row);
    });
}

function createSession(name, callback) {
  // End any currently active session first
  endActiveSession(() => {
    const sql = `INSERT INTO sessions (name) VALUES (?)`;
    db.run(sql, [name], function(err) {
      if (callback) callback(err, this.lastID);
    });
  });
}

function endActiveSession(callback) {
  const sql = `UPDATE sessions SET end_time = CURRENT_TIMESTAMP WHERE end_time IS NULL`;
  db.run(sql, [], function(err) {
    if (callback) callback(err);
  });
}

function getActiveSession(callback) {
  const sql = `SELECT * FROM sessions WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1`;
  db.get(sql, [], (err, row) => {
    if (callback) callback(err, row);
  });
}

function updateTargetTemp(sessionId, temp, callback) {
  const sql = `UPDATE sessions SET target_temp = ? WHERE id = ?`;
  db.run(sql, [temp, sessionId], function(err) {
    if (callback) callback(err);
  });
}

function updateNotifications(sessionId, enabled, callback) {
  const sql = `UPDATE sessions SET notifications_enabled = ? WHERE id = ?`;
  db.run(sql, [enabled ? 1 : 0, sessionId], function(err) {
    if (callback) callback(err);
  });
}

function getSessions(callback) {
  const sql = `SELECT * FROM sessions ORDER BY start_time DESC`;
  db.all(sql, [], (err, rows) => {
    if (callback) callback(err, rows);
  });
}

module.exports = {
  db,
  insertTemperature,
  getHistory,
  getLatest,
  createSession,
  endActiveSession,
  getActiveSession,
  getSessions,
  updateTargetTemp,
  updateNotifications
};
