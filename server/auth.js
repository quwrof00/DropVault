import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

/**
 * Shared authentication helpers for the DropVault backend.
 *
 * The same Supabase admin client backs both the REST API (`requireAuth`) and
 * the collaboration WebSocket handshake, so a session is validated exactly the
 * same way regardless of transport.
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey =
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

export const supabaseAdmin =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

/**
 * Origins allowed to call the API / open a collaboration socket.
 * Configured through `ALLOWED_ORIGINS` (comma separated). When the variable is
 * missing every origin is accepted, which is only sensible for local dev.
 */
export const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

export const isOriginAllowed = (origin) => {
  if (allowedOrigins.length === 0) return true;
  // Non browser clients (native apps, scripts) do not send an Origin header.
  if (!origin) return true;
  return allowedOrigins.includes(origin.replace(/\/+$/, ""));
};

const TOKEN_TTL_MS = 60 * 1000;
const MAX_CACHED_TOKENS = 500;
const verifiedTokens = new Map();

/**
 * Resolves a Supabase access token to a user id.
 * Successful lookups are cached briefly so a reconnecting client does not
 * hammer the auth service.
 */
export const verifyAccessToken = async (token) => {
  if (!token || !supabaseAdmin) return null;

  const cached = verifiedTokens.get(token);
  if (cached && cached.expiresAt > Date.now()) return cached.userId;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;

  if (verifiedTokens.size >= MAX_CACHED_TOKENS) {
    for (const [key, value] of verifiedTokens) {
      if (value.expiresAt <= Date.now()) verifiedTokens.delete(key);
    }
  }

  verifiedTokens.set(token, { userId: data.user.id, expiresAt: Date.now() + TOKEN_TTL_MS });
  return data.user.id;
};

/** Checks that the user is a member of the given room. */
export const isRoomMember = async (roomId, userId) => {
  if (!roomId || !userId || !supabaseAdmin) return false;

  const { data, error } = await supabaseAdmin
    .from("room_users")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("❌ Room membership check failed:", error.message);
    return false;
  }

  return Boolean(data);
};

/**
 * Extracts the access token from a WebSocket handshake.
 *
 * The client sends it as the second offered subprotocol (`bearer, <token>`)
 * so the credential never appears in the request URL. The `token` query
 * parameter is still accepted for non browser clients.
 */
export const extractWsToken = (req, query = {}) => {
  const header = req.headers["sec-websocket-protocol"];
  const offered = (Array.isArray(header) ? header.join(",") : header || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const bearerIndex = offered.indexOf("bearer");
  if (bearerIndex !== -1 && offered[bearerIndex + 1]) return offered[bearerIndex + 1];
  if (offered.length === 1 && offered[0] !== "bearer") return offered[0];

  const queryToken = query.token;
  return typeof queryToken === "string" && queryToken.length > 0 ? queryToken : null;
};
