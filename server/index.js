import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { setupWSConnection } from "@y/websocket-server/utils";
import * as url from "url";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

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

// Initialize Supabase Admin Client for Auth Verification
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Rate Limiter configuration
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP, please try again after 15 minutes" }
});

// Apply rate limiter to all API routes
app.use('/api', apiLimiter);

// Supabase Auth Middleware
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    console.error("Auth Error:", error?.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  req.user = data.user;
  next();
};

// Zod Schemas
const activitySchema = z.object({
  userId: z.string().min(1),
  action: z.string().min(1),
  targetName: z.string().optional()
});

const imageProcessSchema = z.object({
  userId: z.string().min(1),
  roomId: z.string().optional(),
  pathPrefix: z.string().min(1),
  fileName: z.string().min(1)
});

app.get('/api/health', (req, res) => {
    res.json({ status: "ok", timeStamp: new Date().toISOString(), message: "Server running" });
});

// Kafka Producer Endpoint
app.post('/api/activity', requireAuth, async (req, res) => {
  try {
    const { userId, action, targetName } = activitySchema.parse(req.body);
    
    // Ensure the user is only logging activity for themselves
    if (userId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden: Cannot log activity for another user" });
    }

    await logUserActivity(userId, action, targetName);
    res.status(200).json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request payload", details: error.errors });
    }
    console.error("❌ Error sending to Kafka:", error);
    res.status(500).json({ error: "Failed to log activity" });
  }
});

app.post('/api/images/process', requireAuth, async (req, res) => {
  try {
    const { userId, pathPrefix, fileName } = imageProcessSchema.parse(req.body);
    
    if (userId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden: Cannot process images for another user" });
    }

    await publishImageProcessingEvent(userId, pathPrefix, fileName);
    res.status(200).json({ success: true, message: "Image processing queued" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request payload", details: error.errors });
    }
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
