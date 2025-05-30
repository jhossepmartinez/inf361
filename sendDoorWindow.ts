import { generateDoorWindow, sendMessage } from "./helpers";

const sendDoorWindow = () =>
  setInterval(
    () => sendMessage(generateDoorWindow()).catch(console.error),
    1000,
  );

sendDoorWindow();
