const mqtt = require('mqtt');

// Connect to the local Mosquitto broker
const client = mqtt.connect('mqtt://127.0.0.1:1883');

// Simulator state
let smokerTemp = 225.0; // Starts around 225
let meatTemp = 40.0;    // Starts cold from the fridge

// The "stall" behavior could be simulated, but we'll just do a logarithmic-like rise
const targetSmokerTemp = 225.0;

client.on('connect', () => {
  console.log('Simulator connected to MQTT Broker');
  
  // Publish every 10 seconds
  setInterval(() => {
    // 1. Smoker temp fluctuates randomly between -3 and +3 degrees around its target
    // It slowly drifts towards target
    smokerTemp += (targetSmokerTemp - smokerTemp) * 0.1;
    smokerTemp += (Math.random() * 6 - 3);

    // 2. Realistic brisket curve: 40F to 205F in 12 hours with 225F smoker
    // heatTransferRate per 10 seconds = 0.000515
    const heatTransferRate = 0.000515; 
    meatTemp += (smokerTemp - meatTemp) * heatTransferRate;

    // Publish as JSON strings or raw numbers
    // Let's use raw numbers rounded to 1 decimal place to simulate a typical probe
    const pMeat = meatTemp.toFixed(1);
    const pSmoker = smokerTemp.toFixed(1);

    client.publish('bbq/meat', pMeat);
    client.publish('bbq/smoker', pSmoker);

    console.log(`Published -> Meat: ${pMeat}°F, Smoker: ${pSmoker}°F`);
  }, 10000);
});

client.on('error', (err) => {
  console.error('MQTT Error:', err);
});
