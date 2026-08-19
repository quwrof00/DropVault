import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { setupWSConnection } from "@y/websocket-server/utils";
import * as url from "url";

import { initProducer, logUserActivity, publishImageProcessingEvent } from "./kafka/producer.js";
import { initConsumer } from "./kafka/consumer.js";
import { initImageConsumer } from "./kafka/imageConsumer.js";
import { kafka } from "./kafka/client.js";

async function startKafka() {
  try {
    const admin = kafka.admin();
    await admin.connect();
    const topics = await admin.listTopics();
    const topicsToCreate = [];
    if (!topics.includes('user-activity')) {
      topicsToCreate.push({ topic: 'user-activity', numPartitions: 1 });
    }
    if (!topics.includes('image-processing')) {
      topicsToCreate.push({ topic: 'image-processing', numPartitions: 1 });
    }
    
    if (topicsToCreate.length > 0) {
      await admin.createTopics({ topics: topicsToCreate });
      console.log(`✅ Created Kafka topics: ${topicsToCreate.map(t => t.topic).join(', ')}`);
    }
    await admin.disconnect();
  } catch (err) {
    console.error('⚠️ Failed to perform Kafka admin operations (This is normal in managed Kafka if topics are pre-created).', err.message);
  }

  try {
    await initProducer();
    await initConsumer();
    await initImageConsumer();
  } catch (err) {
    console.error('⚠️ Failed to initialize Kafka producer/consumers.', err);
  }
}

startKafka();

console.log("Starting DropVault server...");

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json({ status: "ok", timeStamp: new Date().toISOString(), message: "Server running" });
});

// Kafka Producer Endpoint
app.post('/api/activity', async (req, res) => {
  const { userId, action, targetName } = req.body;
  if (!userId || !action) {
    return res.status(400).json({ error: "Missing required fields: userId, action" });
  }

  try {
    await logUserActivity(userId, action, targetName);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Error sending to Kafka:", error);
    res.status(500).json({ error: "Failed to log activity" });
  }
});

app.post('/api/images/process', async (req, res) => {
  const { userId, pathPrefix, fileName } = req.body;
  if (!userId || !pathPrefix || !fileName) {
    return res.status(400).json({ error: "Missing required fields: userId, pathPrefix, fileName" });
  }

  try {
    await publishImageProcessingEvent(userId, pathPrefix, fileName);
    res.status(200).json({ success: true, message: "Image processing queued" });
  } catch (error) {
    console.error("❌ Error publishing image processing event:", error);
    res.status(500).json({ error: "Failed to queue image processing" });
  }
});

const server = http.createServer(app);

const wss = new WebSocketServer({ server });

wss.on("connection", (conn, req) => {
    const location = url.parse(req.url, true);
    const docName = location.pathname.slice(1);

    console.log("🔗 New Yjs WS connection:", docName);

    setupWSConnection(conn, req, {
        docName,
    });
});

const PORT = process.env.PORT || 1234;
const HOST = process.env.HOST || 'localhost';

server.listen(PORT, () => {
    console.log(`🚀 DropVault Server (Express + Yjs + Kafka) running at http://${HOST}:${PORT}`);
});
