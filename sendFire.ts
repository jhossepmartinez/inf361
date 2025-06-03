import { generateFire, sendMessage } from "./helpers";

const sendFire = () =>
  setInterval(() => sendMessage(generateFire()).catch(console.error), 2000);
sendFire;

sendFire();
