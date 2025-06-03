import { generateGas, sendMessage } from "./helpers";

const sendGas = () =>
  setInterval(() => sendMessage(generateGas()).catch(console.error), 2000);

sendGas();
