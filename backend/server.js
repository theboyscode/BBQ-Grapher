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

const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions });

// Setup MQTT
setupMqtt(io);

// Socket.io connection
io.on('connection', (socket) => {
  console.log('A client connected:', socket.id);

  // Send historical data to the newly connected client (10,000 points = ~27 hours at 10s intervals)
  db.getHistory(10000, (err, rows) => {
    if (err) {
      console.error('Error fetching history', err);
      return;
    }
    socket.emit('history', rows);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
