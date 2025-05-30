import { generateNoise, sendMessage } from "./helpers";

const sendNoise = () =>
  setInterval(() => sendMessage(generateNoise()).catch(console.error), 1000);

sendNoise();
