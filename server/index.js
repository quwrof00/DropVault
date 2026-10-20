import "dotenv/config";
import http from "http";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { setupWSConnection } from "@y/websocket-server/utils";
import * as url from "url";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";

import { initProducer, logUserActivity, publishImageProcessingEvent } from "./kafka/producer.js";
import { initConsumer } from "./kafka/consumer.js";
import { initImageConsumer } from "./kafka/imageConsumer.js";
import { kafka } from "./kafka/client.js";
import {
  allowedOrigins,
  extractWsToken,
  isOriginAllowed,
  isRoomMember,
  supabaseAdmin as supabase,
  verifyAccessToken,
} from "./auth.js";

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

// Only the configured frontend origins may call the API. When
// `ALLOWED_ORIGINS` is unset every origin is accepted (local dev only).
app.use(
  cors({
    origin: (origin, callback) => {
      if (allowedOrigins.length === 0 || isOriginAllowed(origin)) {
        return callback(null, true);
      }
      // No CORS headers -> the browser blocks the request.
      return callback(null, false);
    },
  })
);
app.use(express.json());

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
  if (!supabase) {
    return res.status(503).json({ error: 'Service unavailable: auth backend not configured' });
  }

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

// Health check lives outside the rate limiter so orchestrators can poll it
// without burning the API budget.
app.get('/health', (req, res) => {
    res.json({ status: "ok", timeStamp: new Date().toISOString(), message: "Server running" });
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

// --- Collaboration WebSocket server -----------------------------------------
// The socket is only established for authenticated users that are members of
// the room the requested document belongs to.

const WS_PATH_PREFIX = "/collab/";
const WS_AUTH_WINDOW_MS = 15 * 60 * 1000;
const WS_AUTH_MAX_FAILURES = 20;
const wsAuthFailures = new Map();

const wss = new WebSocketServer({
  noServer: true,
  // Echo the "bearer" subprotocol back. The access token is the second
  // offered value and must never be reflected to the client.
  handleProtocols: (protocols) => (protocols.has("bearer") ? "bearer" : false),
});

const clientIp = (req) => req.socket?.remoteAddress || "unknown";

const isAuthRateLimited = (ip) => {
  const now = Date.now();
  const entry = wsAuthFailures.get(ip);
  if (!entry || entry.resetAt <= now) {
    wsAuthFailures.set(ip, { count: 0, resetAt: now + WS_AUTH_WINDOW_MS });
    return false;
  }
  return entry.count >= WS_AUTH_MAX_FAILURES;
};

const recordAuthFailure = (ip) => {
  const now = Date.now();
  const entry = wsAuthFailures.get(ip) || { count: 0, resetAt: now + WS_AUTH_WINDOW_MS };
  if (entry.resetAt <= now) {
    entry.count = 0;
    entry.resetAt = now + WS_AUTH_WINDOW_MS;
  }
  entry.count += 1;
  wsAuthFailures.set(ip, entry);
};

const decodeDocName = (pathname = "") => {
  const withoutPrefix = pathname.startsWith(WS_PATH_PREFIX)
    ? pathname.slice(WS_PATH_PREFIX.length)
    : pathname.replace(/^\//, "");
  try {
    return decodeURIComponent(withoutPrefix);
  } catch {
    return withoutPrefix;
  }
};

server.on("upgrade", (req, socket, head) => {
  const location = url.parse(req.url || "/", true);
  const origin = req.headers.origin;

  if (!isOriginAllowed(origin)) {
    console.warn(`🚫 Blocked WebSocket upgrade from disallowed origin: ${origin}`);
    socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (conn) => {
    wss.emit("connection", conn, req, location);
  });
});

wss.on("connection", async (conn, req, location) => {
  const docName = decodeDocName(location.pathname);
  const roomId = typeof location.query.roomId === "string" ? location.query.roomId : null;
  const ip = clientIp(req);

  if (isAuthRateLimited(ip)) {
    conn.close(4429, "Too many authentication attempts");
    return;
  }

  const token = extractWsToken(req, location.query);
  const userId = token ? await verifyAccessToken(token) : null;

  if (!userId) {
    recordAuthFailure(ip);
    console.warn(`🚫 Rejected WebSocket connection to "${docName}" (invalid session)`);
    conn.close(4401, "Invalid or expired session");
    return;
  }

  if (!roomId || !docName.startsWith(`${roomId}-`)) {
    recordAuthFailure(ip);
    console.warn(`🚫 Rejected WebSocket connection to "${docName}" (document outside requested room)`);
    conn.close(4403, "Document does not belong to the requested room");
    return;
  }

  if (!(await isRoomMember(roomId, userId))) {
    recordAuthFailure(ip);
    console.warn(`🚫 Rejected WebSocket connection to "${docName}" (not a room member)`);
    conn.close(4403, "Not a member of this room");
    return;
  }

  console.log(`🔗 New Yjs WS connection: ${docName}`);

  setupWSConnection(conn, req, {
    docName,
  });
});

const PORT = process.env.PORT || 1234;
const HOST = process.env.HOST || 'localhost';

server.listen(PORT, () => {
    console.log(`🚀 DropVault Server (Express + Yjs + Kafka) running at http://${HOST}:${PORT}`);
});
