const { Aedes } = require('aedes');
const { createServer } = require('aedes-server-factory');

async function start() {
  const aedes = await Aedes.createBroker();
  const server = createServer(aedes);
  const port = 1883;

  server.listen(port, '0.0.0.0', function () {
    console.log('Aedes MQTT broker started and listening on 0.0.0.0:', port);
  });

  const EXPECTED_USER = process.env.MQTT_USER || 'bbq_admin';
  const EXPECTED_PASS = process.env.MQTT_PASS || 'bbq_secret';

  aedes.authenticate = function (client, username, password, callback) {
    if (username === EXPECTED_USER && password && password.toString() === EXPECTED_PASS) {
      callback(null, true);
    } else {
      console.warn(`[AUTH FAILED] Client ${client ? client.id : 'unknown'} attempted to connect with invalid credentials.`);
      const error = new Error('Authentication Failed');
      error.returnCode = 4; // Bad username or password
      callback(error, null);
    }
  };

  aedes.on('client', function (client) {
    console.log('Client Connected: \x1b[33m' + (client ? client.id : client) + '\x1b[0m', 'to broker', aedes.id);
  });

  aedes.on('clientDisconnect', function (client) {
    console.log('Client Disconnected: \x1b[31m' + (client ? client.id : client) + '\x1b[0m', 'to broker', aedes.id);
  });
}

start();
