import { generateFire, sendMessage } from "./helpers";

const sendFire = () =>
  setInterval(() => sendMessage(generateFire()).catch(console.error), 1000);
sendFire;

sendFire();
