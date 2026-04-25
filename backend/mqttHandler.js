const mqtt = require('mqtt');
const db = require('./db');

function setupMqtt(io) {
  // Connect to Docker broker with credentials
  const mqttUser = process.env.MQTT_USER || 'bbq_admin';
  const mqttPass = process.env.MQTT_PASS || 'bbq_secret';
  const mqttHost = process.env.MQTT_HOST || 'broker';
  
  const mqttUrl = `mqtt://${mqttUser}:${mqttPass}@${mqttHost}:1883`;
  const client = mqtt.connect(mqttUrl);

  client.on('connect', () => {
    console.log('Connected to MQTT Broker');
    client.subscribe(['bbq/meat', 'bbq/smoker', 'bbq/probe3', 'bbq/probe4', '/feeds/bbq_battery'], (err) => {
      if (err) {
        console.error('Failed to subscribe to topics', err);
      } else {
        console.log('Subscribed to all 4 bbq probes and battery topics');
      }
    });
  });

  // State to hold partial updates if they arrive at different exact milliseconds
  let currentMeatTemp = null;
  let currentSmokerTemp = null;
  let currentProbe3 = null;
  let currentProbe4 = null;
  let currentBattery = null;

  // We load the last known state from DB to avoid nulls
  db.getLatest((err, row) => {
    if (row) {
        currentMeatTemp = row.meatTemp;
        currentSmokerTemp = row.smokerTemp;
        currentProbe3 = row.probe3;
        currentProbe4 = row.probe4;
        currentBattery = row.battery;
    }
  });

  client.on('message', (topic, message) => {
    // message is Buffer
    let valStr = message.toString();
    let temp = null;
    
    // Try to parse JSON just in case, otherwise treat as string/number
    try {
        const parsed = JSON.parse(valStr);
        if (parsed && typeof parsed.temp !== 'undefined') {
            temp = parseFloat(parsed.temp);
        } else {
            temp = parseFloat(valStr);
        }
    } catch (e) {
        temp = parseFloat(valStr);
    }

    if (isNaN(temp)) {
        console.warn('Received invalid temperature:', valStr);
        return;
    }

    let updated = false;
    if (topic === 'bbq/meat') {
      currentMeatTemp = temp;
      updated = true;
    } else if (topic === 'bbq/smoker') {
      currentSmokerTemp = temp;
      updated = true;
    } else if (topic === 'bbq/probe3') {
      currentProbe3 = temp;
      updated = true;
    } else if (topic === 'bbq/probe4') {
      currentProbe4 = temp;
      updated = true;
    } else if (topic === '/feeds/bbq_battery') {
      currentBattery = temp;
      updated = true;
    }

    if (updated) {
        // Insert into DB and emit to frontend
        db.insertTemperature(currentMeatTemp, currentSmokerTemp, currentProbe3, currentProbe4, currentBattery, (err, lastID) => {
            if (err) {
                console.error('Failed to insert temp to DB', err);
                return;
            }
            
            // Re-fetch the newly inserted row to get the exact DB timestamp
            db.db.get(`SELECT * FROM temperatures WHERE id = ?`, [lastID], (err, row) => {
                if (row) {
                    io.emit('temperatureUpdate', row);
                }
            });
        });
    }
  });
}

module.exports = setupMqtt;
