const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const setupMqtt = require('./mqttHandler');
const db = require('./db');

const app = express();
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173", // Restrict to trusted origin
  methods: ["GET", "POST"]
};

app.use(cors(corsOptions));
app.use(express.json()); // Parse JSON body for API requests

const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions });

// Setup MQTT
setupMqtt(io);

// Socket.io connection
io.on('connection', (socket) => {
  console.log('A client connected:', socket.id);

  // Fetch the active session to get its history
  db.getActiveSession((err, session) => {
    if (session) {
      socket.emit('activeSession', session);
      db.getHistory(session.id, 10000, (err, rows) => {
        if (!err && rows) {
          socket.emit('history', rows);
        }
      });
    } else {
      socket.emit('activeSession', null);
      socket.emit('history', []); // Empty history if no active session
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// --- REST API FOR SESSIONS ---

app.post('/api/sessions/start', (req, res) => {
  const { name } = req.body;
  if (name !== undefined && typeof name !== 'string') {
    return res.status(400).json({ error: "Name must be a string" });
  }
  db.createSession(name || 'New Cook', (err, sessionId) => {
    if (err) return res.status(500).json({ error: err.message });
    // Notify all clients that a new session started
    db.getActiveSession((err, session) => {
      io.emit('activeSession', session);
      io.emit('history', []); // clear graph
      res.json(session);
    });
  });
});

app.post('/api/sessions/end', (req, res) => {
  db.endActiveSession((err) => {
    if (err) return res.status(500).json({ error: err.message });
    io.emit('activeSession', null);
    res.json({ success: true });
  });
});

app.get('/api/sessions', (req, res) => {
  db.getSessions((err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/sessions/:id/history', (req, res) => {
  db.getHistory(req.params.id, 10000, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/sessions/target', (req, res) => {
  const { sessionId, temp } = req.body;
  if (typeof sessionId !== 'number' || typeof temp !== 'number') {
    return res.status(400).json({ error: "sessionId and temp must be numbers" });
  }
  db.updateTargetTemp(sessionId, temp, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    // Notify clients that the target temp changed
    io.emit('targetTempChanged', { temp });
    res.json({ success: true, temp });
  });
});

app.post('/api/sessions/notifications', (req, res) => {
  const { sessionId, enabled } = req.body;
  if (typeof sessionId !== 'number' || typeof enabled !== 'boolean') {
    return res.status(400).json({ error: "sessionId must be a number and enabled must be a boolean" });
  }
  db.updateNotifications(sessionId, enabled, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    // Notify clients so UI updates
    io.emit('notificationsChanged', { enabled });
    res.json({ success: true, enabled });
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
