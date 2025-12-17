import http from "http";
import WebSocket from "ws";
import { setupWSConnection } from "y-websocket/server";
import * as url from "url";

// No persistence for now (Windows breaks)
console.log("Starting Yjs server...");

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Yjs server running");
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (conn, req) => {
  const location = url.parse(req.url, true);
  const docName = location.pathname.slice(1);

  console.log("New connection:", docName);

  setupWSConnection(conn, req, {
    docName,
  });
});

const PORT = 1234;

server.listen(PORT, () => {
  console.log(`🚀 Yjs Websocket server running at ws://localhost:${PORT}`);
});
