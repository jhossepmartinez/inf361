import { connect } from "amqplib";
import { clear } from "console";
import { AMQP_URL, QUEUE_NAME } from "./constant";
import { Sensor } from "./types";

const DAY_HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]; // 7AM to 7PM
const NIGHT_HOURS = [20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6]; // 8PM to 6AM
const NOISE_RANGES = {
  day: { min: 30, max: 90 }, // Higher max during day
  night: { min: 30, max: 70 } // Lower max at night
};

let currentTime = {
  hour: new Date().getHours(),
  isDay: DAY_HOURS.includes(new Date().getHours()),
  formatted: formatTime(new Date())
};

function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

setInterval(() => {
  const now = new Date();
  currentTime = {
    hour: now.getHours(),
    isDay: DAY_HOURS.includes(now.getHours()),
    formatted: formatTime(now)
  };
  updateDisplay(); // Refresh display when time changes
}, 5000);


export const sendMessage = async (message: Sensor) => {
  const connection = await connect(AMQP_URL);
  const channel = await connection.createChannel();

  await channel.assertQueue(QUEUE_NAME, { durable: false });

  channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)));
};

export const logReceiver = async () => {
  const connection = await connect(AMQP_URL);
  const channel = await connection.createChannel();

  await channel.assertQueue(QUEUE_NAME, { durable: false });
  channel.consume(QUEUE_NAME, async (msg) => {
    if (!msg) return;
    const parsedMessage = JSON.parse(msg.content.toString());
    console.log(`${parsedMessage.type}: ${parsedMessage.measurement.value}`);
    channel.ack(msg);
  });
};

type SensorData = {
  air_quality: number[];
  gas: number[];
  fire: number[];
  noise: number[];
  humidity: number[];
  door_window: boolean[];
};

const sensorData: SensorData = {
  air_quality: [],
  gas: [],
  fire: [],
  noise: [],
  humidity: [],
  door_window: [],
};

const validRanges = {
  air_quality: { min: 300, max: 1000 },
  gas: { min: 0, max: 50 },
  fire: { min: 15, max: 35 },
  noise: currentTime.isDay ? NOISE_RANGES.day : NOISE_RANGES.night,
  humidity: { min: 20, max: 80 },
};

const isNumber = (value: unknown): value is number => typeof value === "number";

const activeAlerts: string[] = [];

// Modify the updateDisplay function
function updateDisplay() {
  clear();
  
  // Update noise range based on current time
  validRanges.noise = currentTime.isDay ? NOISE_RANGES.day : NOISE_RANGES.night;
  
  console.log(`📡 REAL-TIME SENSOR MONITORING 📡 [${currentTime.formatted}]`);
  console.log(`🌞 Current mode: ${currentTime.isDay ? 'DAY' : 'NIGHT'}\n`);

  // Filter alerts based on time of day
  const filteredAlerts = activeAlerts.filter(alert => {
    if (alert.includes("Puerta/Ventana") || alert.includes("Door/Window")) {
      return !currentTime.isDay; // Only show door/window alerts at night
    }
    return true; // Show all other alerts
  });

  // Separate critical alerts from warnings
  const criticalAlerts = filteredAlerts.filter(a => a.includes("🚨") || a.includes("💀"));
  const warningAlerts = filteredAlerts.filter(a => !a.includes("🚨") && !a.includes("💀"));

  if (criticalAlerts.length > 0) {
    console.log("🚨🚨🚨 CRITICAL ALERTS 🚨🚨🚨\n");
    criticalAlerts.forEach((alert) => console.log(alert));
    console.log("");
  }

  if (warningAlerts.length > 0) {
    console.log("⚠️⚠️⚠️ WARNING ALERTS ⚠️⚠️⚠️\n");
    warningAlerts.forEach((alert) => console.log(alert));
    console.log("");
  }

  if (filteredAlerts.length === 0) {
    console.log("✅ All systems normal\n");
  }

  // Display last known values
  console.log("📊 Last Sensor Readings:");
  Object.entries(sensorData).forEach(([type, values]) => {
    if (values.length > 0) {
      const lastValue = values[values.length - 1];
      console.log(
        `- ${type.padEnd(15)}: ${lastValue}${type === "door_window" ? "" : getUnit(type)}` +
        (type === "noise" ? ` (${currentTime.isDay ? 'Day' : 'Night'} range: ${validRanges.noise.min}-${validRanges.noise.max}dB)` : '')
      );
    }
  });
}

function getUnit(type: string): string {
  const units: Record<string, string> = {
    air_quality: " ppm",
    gas: " ppm",
    fire: " °C",
    noise: " dB",
    humidity: "%",
  };
  return units[type] || "";
}

export const alertReceiver = async () => {
  const connection = await connect(AMQP_URL);
  const channel = await connection.createChannel();

  await channel.assertQueue(QUEUE_NAME, { durable: false });

  console.log("Starting monitoring system...");
  updateDisplay();

  channel.consume(QUEUE_NAME, (msg) => {
    if (!msg) return;

    const { type, measurement }: Sensor = JSON.parse(msg.content.toString());
    const value = measurement.value;

    // Store value
    if (type === "door_window") {
      if (typeof value === "boolean") {
        sensorData.door_window.push(value);
        if (value) {
          const alertMsg = "🚨 Alarma + Carabineros (Puerta/Ventana abierta)";
          if (!activeAlerts.includes(alertMsg)) {
            activeAlerts.push(alertMsg);
          }
        } else {
          const index = activeAlerts.findIndex(a => a.includes("Puerta/Ventana"));
          if (index >= 0) activeAlerts.splice(index, 1);
        }
      }
    } else {
      if (typeof value === "number") {
        sensorData[type].push(value);

        const range = validRanges[type];
        const isOutOfRange = value < range.min || value > range.max;

        if (isOutOfRange) {
          let alertMsg = "";
          
          switch(type) {
            case "gas":
              alertMsg = "⚠️ Cierre válvula de gas";
              if (value > 1000) {
                alertMsg = "💀 CRITICAL: " + alertMsg + " (Fuga grave detectada)";
              }
              break;
            case "air_quality":
              alertMsg = "⚠️ Activar sistema de ventilación";
              break;
            case "fire":
              alertMsg = "🚨 Alarma + Bomberos (Temperatura crítica)";
              break;
            case "noise":
      const noiseRange = currentTime.isDay ? NOISE_RANGES.day : NOISE_RANGES.night;
      if (value > noiseRange.max) {
        alertMsg = `⚠️ Notificar exceso de ruido (${value}dB durante ${currentTime.isDay ? 'el día' : 'la noche'})`;
      }
      break;
            case "humidity":
              // No specific action for humidity in requirements
              alertMsg = `⚠️ Humedad fuera de rango (${value}%)`;
              break;
          }

          const existingIndex = activeAlerts.findIndex(a => a.includes(alertMsg.split(':')[0] ?? alertMsg));
          if (existingIndex >= 0) {
            activeAlerts[existingIndex] = alertMsg;
          } else if (alertMsg) {
            activeAlerts.push(alertMsg);
          }
        } else {
          // Remove alert if value is back to normal
          const alertPrefix = {
            gas: "Cierre válvula",
            air_quality: "Activar sistema",
            fire: "Alarma + Bomberos",
            noise: "Notificar exceso",
            humidity: "Humedad fuera"
          }[type];
          
          if (alertPrefix) {
            const alertIndex = activeAlerts.findIndex(a => a.includes(alertPrefix));
            if (alertIndex >= 0) {
              activeAlerts.splice(alertIndex, 1);
            }
          }
        }
      }
    }

    updateDisplay();
    channel.ack(msg);
  });
};

export const generateAirQuality = () => ({
  type: "air_quality" as const,
  measurement: {
    type: "co2" as const,
    value: Math.floor(300 + Math.random() * 1700),
  },
});

export const generateGas = () => ({
  type: "gas" as const,
  measurement: {
    type: "methane" as const,
    value: Math.floor(
      Math.random() > 0.95 ? 1000 + Math.random() * 4000 : Math.random() * 50,
    ),
  },
});

export const generateFire = () => ({
  type: "fire" as const,
  measurement: {
    type: "temperature" as const,
    value: Math.floor(15 + Math.random() * 40),
  },
});

export const generateNoise = () => ({
  type: "noise" as const,
  measurement: {
    type: "db_level" as const,
    value: Math.floor(30 + Math.random() * 70),
  },
});

export const generateHumidity = () => ({
  type: "humidity" as const,
  measurement: {
    type: "relative_humidity" as const,
    value: Math.floor(20 + Math.random() * 60),
  },
});

export const generateDoorWindow = () => ({
  type: "door_window" as const,
  measurement: {
    type: "open_status" as const,
    value: Math.random() > 0.8, // 20% chance of being open
  },
});
