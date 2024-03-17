import * as M from "./model";
import WebSocket from "ws";

const host = "localhost";
const port = 3000;

const ws = new WebSocket(`ws://${host}:${port}`);

ws.on("open", () => {
  console.log("[Client] ws open");
  const message: M.StartupMessage = {
    _tag: "startup",
    color: "magenta",
    name: process.argv[2] ?? "Corentin",
  };
  ws.send(JSON.stringify(message), (err) => {
    console.log({ err });
  });

  setTimeout(() => {
    const msg: M.ServerIncomingMessage = {
      _tag: "message",
      message: "First message",
    };
    ws.send(JSON.stringify(msg));
  }, 1000);

  ws.on("message", (data) => {
    console.log(`[Client] message: ${data.toString()}`);
  });
  ws.on("error", (error) => {
    console.log("[Client] ws error");
  });
  ws.on("close", () => {
    console.log("[Client] Closed!");
    process.exit();
  });
});
