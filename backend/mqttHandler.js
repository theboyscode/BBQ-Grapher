const mqtt = require('mqtt');
const db = require('./db');
const weather = require('./weather');
const nodemailer = require('nodemailer');

function setupMqtt(io) {
  let insertDebounceTimer = null;
  let lastSessionId = null;
  let lastTargetTemp = null;
  let hasAlertedTarget = false;
  let hasAlertedFire = false;
  let lastIntervalEmailTime = 0;
  
  const mqttUser = process.env.MQTT_USER || 'bbq_admin';
  const mqttPass = process.env.MQTT_PASS || 'bbq_secret';
  const mqttHost = process.env.MQTT_HOST || 'broker';
  
  const mqttUrl = `mqtt://${mqttUser}:${mqttPass}@${mqttHost}:1883`;
  const client = mqtt.connect(mqttUrl);

  client.on('connect', () => {
    console.log('Connected to MQTT Broker');
    client.subscribe(['bbq/probe1', 'bbq/probe2', 'bbq/probe3', 'bbq/probe4', '/feeds/bbq_battery'], (err) => {
      if (err) console.error('Failed to subscribe to topics', err);
      else console.log('Subscribed to raw bbq probes and battery topics');
    });
  });

  let rawProbe1 = null, rawProbe2 = null, rawProbe3 = null, rawProbe4 = null, currentBattery = null;

  function sendEmailAlert(subject, alertReason, data) {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const to = process.env.EMAIL_TO;

    if (!user || !pass || !to) {
        console.log("Email credentials not configured. Skipping email:", subject);
        return;
    }

    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
    });

    const html = `
        <div style="font-family: sans-serif; max-width: 500px; margin: auto; padding: 20px; background-color: #f9f9f9; border-radius: 10px;">
            <h2 style="color: #d97706; text-align: center;">BBQ Grapher Update</h2>
            ${alertReason ? `<h3 style="color: #dc2626; text-align: center;">${alertReason}</h3>` : ''}
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 16px;">
                <tr style="background-color: #e5e7eb;">
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ccc;">Metric</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #ccc;">Value</th>
                </tr>
                <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #eee;">🥩 Meat (Primary)</td>
                    <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee;"><strong>${data.meatTemp ? data.meatTemp.toFixed(1) : '--'}°F</strong> / ${data.targetTemp || '--'}°F</td>
                </tr>
                <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #eee;">🔥 Smoker (Primary)</td>
                    <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee;"><strong>${data.smokerTemp ? data.smokerTemp.toFixed(1) : '--'}°F</strong></td>
                </tr>
                ${data.probe3 > 0 ? `<tr><td style="padding: 12px; border-bottom: 1px solid #eee;">🌡️ Probe 3</td><td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee;"><strong>${data.probe3.toFixed(1)}°F</strong></td></tr>` : ''}
                ${data.probe4 > 0 ? `<tr><td style="padding: 12px; border-bottom: 1px solid #eee;">🌡️ Probe 4</td><td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee;"><strong>${data.probe4.toFixed(1)}°F</strong></td></tr>` : ''}
                <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #eee;">🌤️ Ambient</td>
                    <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee;"><strong>${data.ambientTemp ? data.ambientTemp.toFixed(1) : '--'}°F</strong></td>
                </tr>
                <tr>
                    <td style="padding: 12px; border-bottom: 1px solid #eee;">🔋 Battery</td>
                    <td style="padding: 12px; text-align: right; border-bottom: 1px solid #eee;"><strong>${data.battery ? data.battery.toFixed(0) : '--'}%</strong></td>
                </tr>
            </table>
        </div>
    `;

    transporter.sendMail({
        from: `"BBQ Grapher" <${user}>`,
        to: to,
        subject: subject,
        html: html
    }).catch(err => console.error("Email failed:", err));
  }

  client.on('message', (topic, message) => {
    let valStr = message.toString();
    let temp = null;
    try {
        const parsed = JSON.parse(valStr);
        if (parsed && typeof parsed.temp !== 'undefined') temp = parseFloat(parsed.temp);
        else temp = parseFloat(valStr);
    } catch (e) {
        temp = parseFloat(valStr);
    }
    if (isNaN(temp)) return;

    let updated = false;
    if (topic === 'bbq/probe1') { rawProbe1 = temp; updated = true; }
    else if (topic === 'bbq/probe2') { rawProbe2 = temp; updated = true; }
    else if (topic === 'bbq/probe3') { rawProbe3 = temp; updated = true; }
    else if (topic === 'bbq/probe4') { rawProbe4 = temp; updated = true; }
    else if (topic === '/feeds/bbq_battery') { currentBattery = temp; updated = true; }

    if (updated) {
        if (insertDebounceTimer) clearTimeout(insertDebounceTimer);
        insertDebounceTimer = setTimeout(() => {
            db.getActiveSession((err, session) => {
                const mapProbes = (mappings) => {
                    let meatTemp = null, smokerTemp = null, probe3 = null, probe4 = null;
                    const assign = (role, val) => {
                        if (role === 'meat_primary') meatTemp = val;
                        else if (role === 'smoker_primary') smokerTemp = val;
                        else if (role === 'meat_secondary') probe3 = val;
                        else if (role === 'smoker_secondary') probe4 = val;
                    };
                    assign(mappings.probe1_role, rawProbe1);
                    assign(mappings.probe2_role, rawProbe2);
                    assign(mappings.probe3_role, rawProbe3);
                    assign(mappings.probe4_role, rawProbe4);
                    return { meatTemp, smokerTemp, probe3, probe4 };
                };

                const processData = (mappings) => {
                    const { meatTemp, smokerTemp, probe3, probe4 } = mapProbes(mappings);
                    const ambientTemp = weather.getCurrentAmbientTemp();

                    if (session) {
                        if (lastSessionId !== session.id || lastTargetTemp !== session.target_temp) {
                            if (lastSessionId !== session.id) {
                                hasAlertedTarget = false;
                                hasAlertedFire = false;
                                lastIntervalEmailTime = Date.now(); // Reset timer for new session
                            } else {
                                if (meatTemp < session.target_temp) hasAlertedTarget = false;
                            }
                            lastSessionId = session.id;
                            lastTargetTemp = session.target_temp;
                        }

                        if (session.notifications_enabled) {
                            const emailData = {
                                meatTemp, smokerTemp, probe3, probe4,
                                ambientTemp, battery: currentBattery,
                                targetTemp: session.target_temp
                            };

                            if (meatTemp >= session.target_temp && !hasAlertedTarget) {
                                sendEmailAlert(`🔥 Target Reached: ${meatTemp ? meatTemp.toFixed(1) : '--'}°F!`, `Meat has reached target temp of ${session.target_temp}°F!`, emailData);
                                hasAlertedTarget = true;
                            } else if (meatTemp < session.target_temp - 5) {
                                hasAlertedTarget = false;
                            }

                            if (smokerTemp > 0 && smokerTemp < 200 && !hasAlertedFire && meatTemp < session.target_temp) {
                                sendEmailAlert(`⚠️ Low Fire: ${smokerTemp ? smokerTemp.toFixed(1) : '--'}°F`, `Smoker temp has dropped to ${smokerTemp ? smokerTemp.toFixed(1) : '--'}°F. Check the fire!`, emailData);
                                hasAlertedFire = true;
                            } else if (smokerTemp > 220) {
                                hasAlertedFire = false;
                            }

                            if (session.update_interval > 0) {
                                const now = Date.now();
                                if (now - lastIntervalEmailTime >= session.update_interval * 60000) {
                                    sendEmailAlert(`📊 BBQ Status Update`, null, emailData);
                                    lastIntervalEmailTime = now;
                                }
                            }
                        }

                        db.insertTemperature(session.id, meatTemp, smokerTemp, probe3, probe4, currentBattery, ambientTemp, (err, lastID) => {
                            if (!err) {
                                db.db.get(`SELECT * FROM temperatures WHERE id = ?`, [lastID], (err, row) => {
                                    if (row) io.emit('temperatureUpdate', row);
                                });
                            }
                        });
                    } else {
                        lastSessionId = null;
                        hasAlertedTarget = false;
                        hasAlertedFire = false;
                        io.emit('temperatureUpdate', {
                            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                            meatTemp, smokerTemp, probe3, probe4, battery: currentBattery, ambientTemp
                        });
                    }
                };

                if (session) {
                    processData(session);
                } else {
                    db.getGlobalSettings((err, settings) => {
                        processData(settings || {
                            probe1_role: 'meat_primary', probe2_role: 'smoker_primary',
                            probe3_role: 'none', probe4_role: 'none', update_interval: 0
                        });
                    });
                }
            });
        }, 500);
    }
  });
}

module.exports = setupMqtt;
