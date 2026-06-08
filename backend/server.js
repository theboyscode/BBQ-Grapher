const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const setupMqtt = require('./mqttHandler');
const db = require('./db');
const nodemailer = require('nodemailer');

const app = express();
const corsOptions = {
  origin: "*", // Allow any device on the local network to connect
  methods: ["GET", "POST"]
};

app.use(cors(corsOptions));
app.use(express.json()); // Parse JSON body for API requests

const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions });

// Setup MQTT
setupMqtt(io);

// Setup Weather Polling
const weather = require('./weather');
weather.startPolling();

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
  const { name, zipCode } = req.body;
  if (name !== undefined && typeof name !== 'string') {
    return res.status(400).json({ error: "Name must be a string" });
  }
  if (zipCode !== undefined && typeof zipCode !== 'string') {
    return res.status(400).json({ error: "Zip Code must be a string" });
  }
  db.createSession(name || 'New Cook', zipCode || '', (err, sessionId) => {
    if (err) return res.status(500).json({ error: err.message });
    // Notify all clients that a new session started
    db.getActiveSession((err, session) => {
      weather.forcePoll();
      io.emit('activeSession', session);
      io.emit('history', []); // clear graph
      res.json(session);
    });
  });
});

app.post('/api/sessions/end', (req, res) => {
  db.getActiveSession((err, session) => {
    if (!session) return res.json({ success: true, message: "No active session" });
    db.endActiveSession((err) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // Run decimation in the background
      db.decimateSession(session.id, (err) => {
        if (err) console.error("Decimation error:", err);
        else console.log(`Session ${session.id} successfully decimated.`);
      });

      io.emit('activeSession', null);
      res.json({ success: true });
    });
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

app.post('/api/sessions/zip', (req, res) => {
  const { sessionId, zipCode } = req.body;
  if (typeof sessionId !== 'number' || typeof zipCode !== 'string') {
    return res.status(400).json({ error: "sessionId must be a number and zipCode must be a string" });
  }
  db.updateZipCode(sessionId, zipCode, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    weather.forcePoll();
    io.emit('zipCodeChanged', { zipCode });
    res.json({ success: true, zipCode });
  });
});

app.get('/api/settings/probes', (req, res) => {
  db.getGlobalSettings((err, settings) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(settings || {
      probe1_role: 'meat_primary',
      probe2_role: 'smoker_primary',
      probe3_role: 'none',
      probe4_role: 'none',
      update_interval: 0
    });
  });
});

app.post('/api/settings/probes', (req, res) => {
  const { p1, p2, p3, p4, interval } = req.body;
  db.getActiveSession((err, session) => {
    if (session) {
      return res.status(403).json({ error: "Cannot change probe settings while a cook is active" });
    }
    db.updateGlobalSettings(p1, p2, p3, p4, interval || 0, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

app.post('/api/sessions/interval', (req, res) => {
  const { sessionId, interval } = req.body;
  if (typeof sessionId !== 'number' || typeof interval !== 'number') {
    return res.status(400).json({ error: "sessionId and interval must be numbers" });
  }
  db.updateSessionInterval(sessionId, interval, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    io.emit('intervalChanged', { interval });
    res.json({ success: true, interval });
  });
});

app.post('/api/settings/test-email', (req, res) => {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const to = process.env.EMAIL_TO;

  if (!user || !pass || !to) {
    return res.status(400).json({ error: "Email credentials are not configured in the .env file." });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });

  const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; background-color: #f9f9f9; border-radius: 10px;">
        <h2 style="color: #d97706; text-align: center;">BBQ Grapher Test</h2>
        <p style="text-align: center; color: #333;">This is a test email to verify your SMTP configuration is working correctly.</p>
        <p style="text-align: center; color: #333;">Happy Smoking! 🍖</p>
    </div>
  `;

  transporter.sendMail({
    from: `"BBQ Grapher" <${user}>`,
    to: to,
    subject: "✅ BBQ Grapher: Test Email",
    html: html
  }).then(() => {
    res.json({ success: true, message: "Test email sent successfully!" });
  }).catch(err => {
    console.error("Test email failed:", err);
    res.status(500).json({ error: err.message });
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
