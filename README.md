# BBQ Grapher Pro 🍖🔥

BBQ Grapher Pro is a full-stack, predictive IoT BBQ monitoring system. It intercepts Bluetooth data from a smart thermometer using an ESP32 microcontroller, relays it over Wi-Fi via MQTT to a self-hosted Docker stack, and provides a beautiful, real-time React dashboard with intelligent "Stall" detection and Twilio SMS alerts.

## 🌟 Features
- **Real-Time Dashboard:** Watch your meat and smoker temperatures live with smooth Chart.js visualizations.
- **Session Tracking (The Cookbook):** Start and end distinct cooking sessions. All data is saved to a local SQLite database so you can review your historical cooks later.
- **Algorithmic Stall Detection:** Uses Newton's Law of Cooling and real-time slope analysis to mathematically detect when your meat hits "The Stall" (evaporative cooling plateau).
- **SMS Alerts:** Integrates with Twilio to send a text message to your phone when the meat reaches its target temperature or if your smoker fire drops below 200°F.
- **Fully Self-Hosted:** Runs 100% locally on your network via Docker. No cloud subscriptions required (other than a cheap Twilio API key for texts).

---

## 🛠️ Hardware Requirements

To run the physical data-collection side of this project, you will need two things:

### 1. Compatible Thermometer
This project uses the `adafruit_ble_ibbq` CircuitPython library. It is compatible with **Inkbird iBBQ Bluetooth Thermometers**. 
**Known Compatible Models:**
- Inkbird IBT-4XS (Recommended: 4 Probes)
- Inkbird IBT-6X
- Inkbird IBT-2X
- Any other thermometer that uses the standard "iBBQ" BLE protocol.

### 2. Compatible Microcontroller
You need a microcontroller capable of running **CircuitPython** with native support for both **Wi-Fi** and **Bluetooth Low Energy (BLE)**.
**Recommended Board:**
- Adafruit Feather ESP32-S3 (with or without PSRAM)
*Note: Older nRF52840 boards will not work unless paired with an AirLift Wi-Fi coprocessor. Stick to an ESP32-S3 or ESP32-C3 for native support of both wireless protocols.*

---

## 🚀 Setup Guide

### Phase 1: Server Setup (Docker)
You need a home server, Raspberry Pi, or always-on PC with Docker installed to host the backend.

1. Clone this repository.
2. If you want SMS alerts, create a file named `.env` in the root directory and add your Twilio credentials:
   ```env
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_FROM_PHONE=+1234567890
   TWILIO_TO_PHONE=+1987654321
   ```
3. Run Docker Compose to build and start the entire stack:
   ```bash
   docker-compose up -d --build
   ```
4. Access the beautiful web interface by navigating to `http://<YOUR_SERVER_IP>:5173`.

### Phase 2: Microcontroller Setup (ESP32)
1. Install the latest version of [CircuitPython](https://circuitpython.org/) onto your ESP32-S3.
2. Copy the `circuitpy-code/code.py` file to the root of your `CIRCUITPY` USB drive.
3. You will need to install the following libraries to the `lib` folder on your `CIRCUITPY` drive via the [Adafruit Bundle](https://circuitpython.org/libraries):
   - `adafruit_ble`
   - `adafruit_ble_ibbq`
   - `adafruit_minimqtt`
   - `adafruit_connection_manager`
4. Create a `settings.toml` file in the root of your `CIRCUITPY` drive with your Wi-Fi and MQTT server details:
   ```toml
   CIRCUITPY_WIFI_SSID = "Your_WiFi_Network"
   CIRCUITPY_WIFI_PASSWORD = "Your_WiFi_Password"
   MQTT_BROKER = "192.168.x.x" # The IP of your Docker server!
   MQTT_USER = "bbq_admin"
   MQTT_PASS = "bbq_secret"
   ```
5. Turn on your Inkbird thermometer. The ESP32 will automatically find it, connect, and start streaming data to your dashboard!

---

## 🏗️ Architecture
- **ESP32 Script:** Scans for BLE iBBQ devices, parses the raw hex temperatures, and publishes them securely to an MQTT broker.
- **Broker Container:** A lightweight Node.js/Aedes MQTT broker.
- **Backend Container:** A Node.js/Express server that listens to MQTT topics, debounces the data, saves it to an SQLite database (`/app/data/bbq_data.db`), handles Twilio webhook logic, and broadcasts live data to the frontend via WebSockets.
- **Frontend Container:** A Vite + React application styled with TailwindCSS and Chart.js, served securely behind an Nginx reverse proxy.
