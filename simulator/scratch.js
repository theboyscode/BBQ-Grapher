const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://127.0.0.1:1883');

client.on('connect', () => {
    console.log("Connected to MQTT, waiting for messages...");
    client.subscribe('#');
});

client.on('message', (topic, msg) => {
    console.log("MQTT Message:", topic, msg.toString());
});

setTimeout(() => {
    console.log("Timeout");
    process.exit(0);
}, 10000);
