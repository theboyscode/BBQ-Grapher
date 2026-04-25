const mqtt = require('mqtt');
const db = require('./db');

const twilio = require('twilio');

function setupMqtt(io) {
  let insertDebounceTimer = null;
  let lastSessionId = null;
  let hasAlertedTarget = false;
  let hasAlertedFire = false;
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

  function sendSmsAlert(message) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_FROM_PHONE;
    const toPhone = process.env.TWILIO_TO_PHONE;
    
    if (!accountSid || !authToken || !fromPhone || !toPhone) return;
    
    const twilioClient = twilio(accountSid, authToken);
    twilioClient.messages.create({
        body: `🔥 BBQ Alert: ${message}`,
        from: fromPhone,
        to: toPhone
    }).catch(err => console.error("Twilio SMS failed:", err));
  }

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
        // Debounce the database insert and UI broadcast
        if (insertDebounceTimer) {
            clearTimeout(insertDebounceTimer);
        }

        insertDebounceTimer = setTimeout(() => {
            db.getActiveSession((err, session) => {
                if (session) {
                    // Reset alert flags on new session
                    if (lastSessionId !== session.id) {
                        lastSessionId = session.id;
                        hasAlertedTarget = false;
                        hasAlertedFire = false;
                    }

                    // Check Webhook Alerts (only if enabled for this session)
                    if (session.notifications_enabled) {
                        if (currentMeatTemp >= session.target_temp && !hasAlertedTarget) {
                            sendSmsAlert(`Meat has reached target temp of ${session.target_temp}°F! Currently at ${currentMeatTemp}°F.`);
                            hasAlertedTarget = true;
                        } else if (currentMeatTemp < session.target_temp - 5) {
                            hasAlertedTarget = false; // Reset if temp drops significantly
                        }

                        if (currentSmokerTemp > 0 && currentSmokerTemp < 200 && !hasAlertedFire && currentMeatTemp < session.target_temp) {
                            sendSmsAlert(`Smoker temp has dropped to ${currentSmokerTemp}°F. Check the fire!`);
                            hasAlertedFire = true;
                        } else if (currentSmokerTemp > 220) {
                            hasAlertedFire = false; // Reset if fire recovers
                        }
                    }

                    // Insert into DB and emit to frontend
                    db.insertTemperature(session.id, currentMeatTemp, currentSmokerTemp, currentProbe3, currentProbe4, currentBattery, (err, lastID) => {
                        if (err) {
                            console.error('Failed to insert temp to DB', err);
                            return;
                        }
                        
                        db.db.get(`SELECT * FROM temperatures WHERE id = ?`, [lastID], (err, row) => {
                            if (row) io.emit('temperatureUpdate', row);
                        });
                    });
                } else {
                    // No active session. Reset state.
                    lastSessionId = null;
                    hasAlertedTarget = false;
                    hasAlertedFire = false;

                    // Emit live updates to UI even without recording to DB
                    io.emit('temperatureUpdate', {
                        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                        meatTemp: currentMeatTemp,
                        smokerTemp: currentSmokerTemp,
                        probe3: currentProbe3,
                        probe4: currentProbe4,
                        battery: currentBattery
                    });
                }
            });
        }, 500); // Wait 500ms for other topic messages to arrive
    }
  });
}

module.exports = setupMqtt;
