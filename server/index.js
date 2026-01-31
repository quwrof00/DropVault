import http from "http";
import { WebSocketServer } from "ws";
import { setupWSConnection } from "@y/websocket-server/utils";
import * as url from "url";


// No persistence for now (Windows breaks)

console.log("Starting Yjs server...");

const server = http.createServer((req, res) => {
    if (req.url === '/api/health') {
        res.writeHead(200);
        res.end(JSON.stringify({ status: "ok", timeStamp: new Date().toISOString(), message: "Yjs server running" }));
        return;
    }
    res.writeHead(200);
    res.end("Yjs server running");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (conn, req) => {
    const location = url.parse(req.url, true);
    const docName = location.pathname.slice(1);

    console.log("New connection:", docName);

    setupWSConnection(conn, req, {
        docName,
    });
});

const PORT = process.env.PORT || 1234;
const HOST = process.env.HOST || 'localhost';

server.listen(PORT, () => {
    console.log(`🚀 Yjs Websocket server running at ws://${HOST}:${PORT}`);
});
