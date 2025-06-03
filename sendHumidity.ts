import { generateHumidity, sendMessage } from "./helpers";

const sendHumidity = () =>
  setInterval(() => sendMessage(generateHumidity()).catch(console.error), 2000);

sendHumidity();
