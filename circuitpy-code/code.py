# SPDX-FileCopyrightText: 2024 johnpark for Adafruit Industries
#
# SPDX-License-Identifier: MIT
'''
BLE BBQ Thermometer to WiFi to Adafruit IO Dashboard
Feather ESP32-S3 8MB No PSRAM
'''
import os
import time
import adafruit_connection_manager
import wifi
import adafruit_minimqtt.adafruit_minimqtt as MQTT
import adafruit_ble
from adafruit_ble.advertising.standard import ProvideServicesAdvertisement
from adafruit_ble_ibbq import IBBQService


aio_username = os.getenv("aio_username")
aio_key = os.getenv("aio_key")

print(f"Connecting to {os.getenv('CIRCUITPY_WIFI_SSID')}")
wifi.radio.connect(
    os.getenv("CIRCUITPY_WIFI_SSID"), os.getenv("CIRCUITPY_WIFI_PASSWORD")
)
print(f"Connected to {os.getenv('CIRCUITPY_WIFI_SSID')}")

### Feeds ###
#feeds = [str(aio_username) + f"/feeds/arduino/bbq{i}" for i in range(1, 4)]
#feeds = [f"/feeds/arduino/bbq{i}" for i in range(1, 5)]
feeds = ["bbq/meat", "bbq/smoker", "bbq/probe3", "bbq/probe4"]
battery_feed = "/feeds/bbq_battery"

print(feeds)


# Define callback methods which are called when events occur
# pylint: disable=unused-argument, redefined-outer-name
def connected(client, userdata, flags, rc):
    print("✅ SUCCESS: Connected to MQTT Broker!")

def disconnected(client, userdata, rc):
    print("❌ WARNING: Disconnected from MQTT Broker!")

# Create a socket pool
pool = adafruit_connection_manager.get_radio_socketpool(wifi.radio)
ssl_context = adafruit_connection_manager.get_radio_ssl_context(wifi.radio)
connection_manager = adafruit_connection_manager.get_connection_manager(pool)

# Set up a MiniMQTT Client
mqtt_client = MQTT.MQTT(
    broker=os.getenv("MQTT_BROKER", "192.168.12.87"),
    port=1883,
    username=os.getenv("MQTT_USER", "bbq_admin"),
    password=os.getenv("MQTT_PASS", "bbq_secret"),
    socket_pool=pool,
    is_ssl=False,
    keep_alive=60,
)



# Setup the callback methods above
mqtt_client.on_connect = connected
mqtt_client.on_disconnect = disconnected

# Connect the client to the MQTT broker.
print("🌐 Connecting to BBQ Grapher MQTT Broker at 192.168.12.87...")
mqtt_client.connect()

# PyLint can't find BLERadio for some reason so special case it here.
ble = adafruit_ble.BLERadio()  # pylint: disable=no-member

ibbq_connection = None
battery_percentage = 100

def c_to_f(temp_c):
    return (temp_c * 9/5) + 32

def volt_to_percent(voltage, max_voltage):
    return (voltage / max_voltage) * 100

def probe_check(temp):  # if value is wildly high no probe is connected
    return temp if temp <= 11000 else 0

battery_val = 3.3


while True:
    print("📡 Scanning for iBBQ Bluetooth thermometer...")
    for adv in ble.start_scan(ProvideServicesAdvertisement, timeout=5):
        if IBBQService in adv.services:
            print("🎯 Found iBBQ thermometer! Attempting to connect...")
            ibbq_connection = ble.connect(adv)
            print("✅ SUCCESS: Connected to iBBQ thermometer over Bluetooth!")
            break

    # Stop scanning whether or not we are connected.
    ble.stop_scan()

    if ibbq_connection and ibbq_connection.connected:
        ibbq_service = ibbq_connection[IBBQService]
        ibbq_service.init()
        while ibbq_connection.connected:
            print(
                "Temperatures:",
                ibbq_service.temperatures,
                "; Battery:",
                ibbq_service.battery_level,
            )

            grill_vals = [probe_check(c_to_f(temp)) for temp in ibbq_service.temperatures]
            battery_val, battery_max = ibbq_service.battery_level
            battery_percentage = (volt_to_percent(battery_val, 3.3))

            try:
                mqtt_client.loop(timeout=1)

                for feed, val in zip(feeds, grill_vals):
                    print(f"   ➜ Sending value: {val:.1f}°F to topic: {feed}")
                    mqtt_client.publish(feed, val)

                mqtt_client.publish(battery_feed, battery_percentage)
                print(f"📦 Successfully published all data! (Battery: {battery_percentage:.0f}%)\n")
            
            except Exception as e:
                print(f"⚠️ MQTT Error: {e}")
                print("🔄 Attempting to reconnect to MQTT Broker...")
                try:
                    mqtt_client.reconnect()
                except Exception as reconnect_e:
                    print(f"❌ Reconnect failed: {reconnect_e}")

            time.sleep(5)
