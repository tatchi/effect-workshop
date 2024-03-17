import { createServer } from "http";
import * as M from "./model";

const currentConnections: Map<string, M.WebSocketConnection> = new Map();

const server = createServer((req, res) => {
  if (req.url !== "/colors") {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  const currentColors = Array.from(currentConnections.values()).map(
    (conn) => conn.color
  );

  const availableColors = M.colors.filter(
    (color) => !currentColors.includes(color)
  );

  const message: M.AvailableColorsResponse = {
    _tag: "availableColors",
    colors: availableColors,
  };

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(message));
});

server.listen(3000, () => {
  console.log("Server started on port 3000");
});
