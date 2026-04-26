const db = require('./db');
const https = require('https');

let currentAmbientTemp = null;
let pollingInterval = null;

function getJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'BBQ-Grapher' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    // Timeout so we don't hang forever
    req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Request Timeout'));
    });
  });
}

async function fetchWeatherForZip(zipCode) {
  try {
    if (!zipCode || zipCode.trim() === '') return null;
    // 1. Get Lat/Lon from Zip Code
    const zipData = await getJSON(`https://api.zippopotam.us/us/${zipCode.trim()}`);
    if (!zipData.places || zipData.places.length === 0) return null;
    const lat = zipData.places[0].latitude;
    const lon = zipData.places[0].longitude;

    // 2. Fetch Weather from Open-Meteo
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&temperature_unit=fahrenheit`;
    const weatherData = await getJSON(weatherUrl);
    if (weatherData.current && weatherData.current.temperature_2m !== undefined) {
      return weatherData.current.temperature_2m;
    }
  } catch (err) {
    console.error("Failed to fetch weather data:", err.message);
  }
  return null;
}

function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  
  const poll = () => {
    db.getActiveSession(async (err, session) => {
      if (!session || !session.zip_code) {
        currentAmbientTemp = null;
        return;
      }
      const temp = await fetchWeatherForZip(session.zip_code);
      if (temp !== null) {
        currentAmbientTemp = temp;
      }
    });
  };

  poll(); // poll immediately
  pollingInterval = setInterval(poll, 15 * 60 * 1000); // 15 minutes
}

function getCurrentAmbientTemp() {
  return currentAmbientTemp;
}

module.exports = {
  startPolling,
  getCurrentAmbientTemp
};
