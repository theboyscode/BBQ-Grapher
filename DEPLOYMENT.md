# Alternative Deployment Guides

This document outlines how to deploy the BBQ Grapher Docker stack to dedicated home server hardware instead of your primary PC.

---

## Deploying to a Raspberry Pi

Running this on a Raspberry Pi is the ideal, perfect home for this project. Since we containerized everything with Docker, it is incredibly easy and the exact same codebase will run natively on the Pi's ARM architecture. 

### 1. Prepare the Raspberry Pi
1. Use the **Raspberry Pi Imager** to flash **Raspberry Pi OS (64-bit)** onto a MicroSD card. (I recommend the "Lite" version without a desktop GUI, as it saves RAM and you'll be managing it via terminal/SSH).
2. Plug it in, connect it to your network, and SSH into it.
3. Find its permanent local IP address (e.g., `192.168.1.150`). It’s highly recommended to set a Static IP for the Pi in your router settings so the ESP32 doesn't lose it if the router reboots.

### 2. Install Docker
Run these commands on the Pi to install Docker and Docker Compose:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```
*(You will need to log out and log back in for the user permissions to apply).*

### 3. Deploy the Code
Clone your repository directly onto the Pi and start the stack:
```bash
# 1. Clone the repo
git clone https://github.com/theboyscode/BBQ-Grapher.git
cd BBQ-Grapher

# 2. Setup your Twilio secrets
nano .env 
# (Paste your TWILIO_ACCOUNT_SID, etc. into this file and save it)

# 3. Build and launch the stack
docker-compose up -d --build
```
Because we used standard `node:20-alpine` and `nginx:alpine` images in our Dockerfiles, Docker will automatically download the correct ARM64 versions for the Pi.

### 4. Re-point the ESP32
The very last step is to tell your ESP32 to talk to the Raspberry Pi instead of your Windows machine.
1. Plug your ESP32 into your PC via USB.
2. Open the `settings.toml` file on the `CIRCUITPY` drive.
3. Change the `MQTT_BROKER` variable to the new IP address of your Raspberry Pi.
4. Save the file and reboot the ESP32.

---

## Deploying to a Synology NAS

Running this on a Synology NAS is an incredible choice! Synology’s operating system (DSM) has native support for Docker, making it a highly reliable and powerful host for this platform.

### 1. Install "Container Manager"
1. Log into your Synology DSM web interface.
2. Open the **Package Center**.
3. Search for and install **Container Manager** (Note: If you are on an older version of DSM 7.1 or below, the app is simply called **Docker**).
4. Once installed, Synology will automatically create a new shared folder called `/docker/` on your main storage volume.

### 2. Move the Code to the NAS
The easiest way to get your code onto the NAS without needing to use the command line is via File Station:
1. Open **File Station** in DSM.
2. Navigate to the `/docker/` folder.
3. Create a new folder inside it called `BBQ-Grapher`.
4. Copy all the files from your PC's BBQ Grapher project folder (including `docker-compose.yml`, the `backend`/`frontend` folders, etc.) into that new `BBQ-Grapher` folder on the NAS. 
5. Ensure your `.env` file with your Twilio secrets is also copied over.

### 3. Spin up the Stack (Using the UI)
Synology’s Container Manager has native support for `docker-compose` through its "Projects" feature:
1. Open the **Container Manager** app.
2. Click on the **Project** tab on the left sidebar, then click **Create**.
3. **Project Name:** `bbq-grapher`
4. **Path:** Click "Set path" and select the `/docker/BBQ-Grapher` folder you just uploaded.
5. **Source:** Choose "Use existing docker-compose.yml" (it will automatically detect the file in that folder).
6. Click **Next** until you finish the wizard. Make sure the checkbox for *"Start the project once it is created"* is checked.
7. Synology will now download the base Node.js/Nginx images, build your custom backend and frontend containers, and start them up!

### 4. Re-point the ESP32
Just like with the Pi, you need to point the physical microcontroller at your NAS:
1. Plug your ESP32 into your PC via USB.
2. Open the `settings.toml` file on the `CIRCUITPY` drive.
3. Change the `MQTT_BROKER` variable to the local IP address of your Synology NAS (e.g., `192.168.1.50`).
4. Save the file and reboot the ESP32.
