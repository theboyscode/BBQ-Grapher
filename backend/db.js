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
        addColumnIfNotExists('sessions', 'zip_code', 'TEXT');
        addColumnIfNotExists('sessions', 'probe1_role', 'TEXT DEFAULT "meat_primary"');
        addColumnIfNotExists('sessions', 'probe2_role', 'TEXT DEFAULT "smoker_primary"');
        addColumnIfNotExists('sessions', 'probe3_role', 'TEXT DEFAULT "none"');
        addColumnIfNotExists('sessions', 'probe4_role', 'TEXT DEFAULT "none"');
        addColumnIfNotExists('sessions', 'update_interval', 'INTEGER DEFAULT 0');
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
        addColumnIfNotExists('temperatures', 'ambientTemp', 'REAL');
      }
    });

    db.run(`CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      probe1_role TEXT DEFAULT 'meat_primary',
      probe2_role TEXT DEFAULT 'smoker_primary',
      probe3_role TEXT DEFAULT 'none',
      probe4_role TEXT DEFAULT 'none',
      update_interval INTEGER DEFAULT 0
    )`, (err) => {
      if (!err) {
        db.run(`INSERT OR IGNORE INTO settings (id) VALUES (1)`);
        addColumnIfNotExists('settings', 'update_interval', 'INTEGER DEFAULT 0');
      }
    });
  }
});

function insertTemperature(sessionId, meatTemp, smokerTemp, probe3, probe4, battery, ambientTemp, callback) {
  const sql = `INSERT INTO temperatures (session_id, meatTemp, smokerTemp, probe3, probe4, battery, ambientTemp) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [sessionId, meatTemp, smokerTemp, probe3, probe4, battery, ambientTemp], function(err) {
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

function getGlobalSettings(callback) {
  db.get(`SELECT * FROM settings WHERE id = 1`, [], (err, row) => {
    if (callback) callback(err, row);
  });
}

function updateGlobalSettings(p1, p2, p3, p4, interval, callback) {
  const sql = `UPDATE settings SET probe1_role = ?, probe2_role = ?, probe3_role = ?, probe4_role = ?, update_interval = ? WHERE id = 1`;
  db.run(sql, [p1, p2, p3, p4, interval], function(err) {
    if (callback) callback(err);
  });
}

function createSession(name, zipCode, callback) {
  // End any currently active session first
  endActiveSession(() => {
    getGlobalSettings((err, settings) => {
      const p1 = settings ? settings.probe1_role : 'meat_primary';
      const p2 = settings ? settings.probe2_role : 'smoker_primary';
      const p3 = settings ? settings.probe3_role : 'none';
      const p4 = settings ? settings.probe4_role : 'none';
      const interval = settings && settings.update_interval ? settings.update_interval : 0;
      
      const sql = `INSERT INTO sessions (name, zip_code, probe1_role, probe2_role, probe3_role, probe4_role, update_interval) VALUES (?, ?, ?, ?, ?, ?, ?)`;
      db.run(sql, [name, zipCode, p1, p2, p3, p4, interval], function(err) {
        if (callback) callback(err, this.lastID);
      });
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

function updateSessionInterval(sessionId, interval, callback) {
  const sql = `UPDATE sessions SET update_interval = ? WHERE id = ?`;
  db.run(sql, [interval, sessionId], function(err) {
    if (callback) callback(err);
  });
}

function updateZipCode(sessionId, zipCode, callback) {
  const sql = `UPDATE sessions SET zip_code = ? WHERE id = ?`;
  db.run(sql, [zipCode, sessionId], function(err) {
    if (callback) callback(err);
  });
}

function getSessions(callback) {
  const sql = `SELECT * FROM sessions ORDER BY start_time DESC`;
  db.all(sql, [], (err, rows) => {
    if (callback) callback(err, rows);
  });
}

function decimateSession(sessionId, callback) {
  const tempTableName = `temp_decimated_${sessionId}`;
  const sqlTemp = `
    CREATE TEMP TABLE IF NOT EXISTS ${tempTableName} AS
    SELECT session_id,
           AVG(meatTemp) as meatTemp,
           AVG(smokerTemp) as smokerTemp,
           AVG(probe3) as probe3,
           AVG(probe4) as probe4,
           AVG(battery) as battery,
           AVG(ambientTemp) as ambientTemp,
           MIN(timestamp) as timestamp
    FROM temperatures
    WHERE session_id = ?
    GROUP BY strftime('%Y-%m-%d %H:%M', timestamp);
  `;
  const sqlDelete = `DELETE FROM temperatures WHERE session_id = ?`;
  const sqlInsert = `
    INSERT INTO temperatures (session_id, meatTemp, smokerTemp, probe3, probe4, battery, ambientTemp, timestamp)
    SELECT session_id, meatTemp, smokerTemp, probe3, probe4, battery, ambientTemp, timestamp
    FROM ${tempTableName};
  `;
  const sqlDrop = `DROP TABLE IF EXISTS ${tempTableName};`;

  db.serialize(() => {
    db.run(sqlDrop, [], () => {}); // Ignore error if table doesn't exist
    db.run(sqlTemp, [sessionId], (err) => {
      if (err) return callback && callback(err);
      db.run(sqlDelete, [sessionId], (err) => {
        if (err) return callback && callback(err);
        db.run(sqlInsert, [], (err) => {
          if (err) return callback && callback(err);
          db.run(sqlDrop, [], (err) => {
            if (callback) callback(err);
          });
        });
      });
    });
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
  updateNotifications,
  updateZipCode,
  decimateSession,
  getGlobalSettings,
  updateGlobalSettings,
  updateSessionInterval
};
