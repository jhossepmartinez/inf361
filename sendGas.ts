import { generateGas, sendMessage } from "./helpers";

const sendGas = () =>
  setInterval(() => sendMessage(generateGas()).catch(console.error), 1000);

sendGas();
