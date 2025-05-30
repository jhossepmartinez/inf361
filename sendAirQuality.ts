import { generateAirQuality, sendMessage } from "./helpers";

const sendAirQuality = () =>
  setInterval(
    () => sendMessage(generateAirQuality()).catch(console.error),
    1000,
  );

sendAirQuality();
