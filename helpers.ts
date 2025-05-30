import { connect } from "amqplib";
import { clear } from "console";
import { AMQP_URL, QUEUE_NAME } from "./constant";
import { Sensor } from "./types";

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

// Valid ranges for each sensor type (last 5 values)
const validRanges = {
  air_quality: { min: 300, max: 1000 }, // CO2 ppm
  gas: { min: 0, max: 50 }, // Methane ppm
  fire: { min: 15, max: 35 }, // Temperature °C
  noise: { min: 30, max: 70 }, // dB
  humidity: { min: 20, max: 80 }, // Percentage
};

const isNumber = (value: unknown): value is number => typeof value === "number";

const activeAlerts: string[] = [];

function updateDisplay() {
  clear();
  console.log("📡 REAL-TIME SENSOR MONITORING 📡\n");

  if (activeAlerts.length === 0) {
    console.log("✅ All systems normal\n");
    console.log("Waiting for sensor data...");
    return;
  }

  console.log("🚨 ACTIVE ALERTS 🚨\n");
  activeAlerts.forEach((alert) => console.log(alert));

  // Display last known values
  console.log("\n📊 Last Sensor Readings:");
  Object.entries(sensorData).forEach(([type, values]) => {
    if (values.length > 0) {
      const lastValue = values[values.length - 1];
      console.log(
        `- ${type.padEnd(15)}: ${lastValue}${type === "door_window" ? "" : getUnit(type)}`,
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
        const alertMsg = "🚪 INTRUDER ALERT: Door/window opened!";
        if (value) {
          if (!activeAlerts.includes(alertMsg)) {
            activeAlerts.push(alertMsg);
          }
        } else {
          const index = activeAlerts.findIndex((a) =>
            a.includes("INTRUDER ALERT"),
          );
          if (index >= 0) activeAlerts.splice(index, 1);
        }
      }
    } else {
      if (typeof value === "number") {
        sensorData[type].push(value);

        // Check last 5 values
        const lastFive = sensorData[type].slice(-5);
        const range = validRanges[type];
        const invalidCount = lastFive.filter(
          (v) => v < range.min || v > range.max,
        ).length;

        const alertPrefix = `⚠️ ${type.toUpperCase().padEnd(12)}:`;

        if (invalidCount > 0) {
          const alertMsg = `${alertPrefix} ${invalidCount}/5 readings out of range (${range.min}-${range.max}${getUnit(type)})`;

          const existingIndex = activeAlerts.findIndex((a) =>
            a.startsWith(alertPrefix),
          );
          if (existingIndex >= 0) {
            activeAlerts[existingIndex] = alertMsg;
          } else {
            activeAlerts.push(alertMsg);
          }

          if (type === "gas" && value > 1000) {
            const criticalMsg =
              "💀 CRITICAL: Gas leak detected! EVACUATE IMMEDIATELY!";
            if (!activeAlerts.includes(criticalMsg)) {
              activeAlerts.push(criticalMsg);
            }
          }
        } else {
          const alertIndex = activeAlerts.findIndex((a) =>
            a.startsWith(alertPrefix),
          );
          if (alertIndex >= 0) {
            activeAlerts.splice(alertIndex, 1);
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
