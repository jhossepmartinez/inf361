import { generateHumidity, sendMessage } from "./helpers";

const sendHumidity = () =>
  setInterval(() => sendMessage(generateHumidity()).catch(console.error), 1000);

sendHumidity();
