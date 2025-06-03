import { generateAirQuality, sendMessage } from "./helpers";

const sendAirQuality = () =>
  setInterval(
    () => sendMessage(generateAirQuality()).catch(console.error),
    2000,
  );

sendAirQuality();
