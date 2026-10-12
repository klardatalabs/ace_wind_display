// Loads .env (if present) and exposes typed configuration for the whole server.
// Must be imported before anything that reads process.env.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const env = process.env;

export const config = {
  port: Number(env.PORT) || 4100,
  // Public origin used in QR codes when the server sits behind a proxy (e.g. https://westonwind.org).
  publicOrigin: env.PUBLIC_ORIGIN || "",
  trustProxy: env.TRUST_PROXY === "1",
  // Protects /api/admin. Leave empty only on a private network.
  adminToken: env.ADMIN_TOKEN || "",

  chat: {
    // Signs anonymous per-tab chat session tokens. Without a fixed secret, tokens
    // are invalidated on every restart (the phone then silently starts a fresh chat).
    sessionSecret: env.CHAT_SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
    historyTtlSec: Number(env.CHAT_HISTORY_TTL_SEC) || 30 * 60,
    maxStoredMessages: 24,
    maxContextMessages: 12,
    maxMessageChars: 600,
    perSessionPerMinute: 8,
    perIpPerMinute: 30,
    screenCommandCooldownSec: 12,
  },

  llm: {
    // Any OpenAI-compatible endpoint works. The first configured key wins.
    anthropicKey: env.ANTHROPIC_API_KEY || "",
    openaiKey: env.OPENAI_API_KEY || "",
    groqKey: env.GROQ_API_KEY || "",
    geminiKey: env.GEMINI_API_KEY || "",
    genericKey: env.LLM_API_KEY || "",
    genericBaseUrl: env.LLM_BASE_URL || "",
    model: env.LLM_MODEL || "",
    temperature: Number(env.LLM_TEMPERATURE ?? 0.4),
    maxTokens: Number(env.LLM_MAX_TOKENS) || 700,
    // Give up on a provider that hasn't started answering in this long, then use the fallback.
    connectTimeoutMs: Number(env.LLM_CONNECT_TIMEOUT_MS) || 20_000,
  },

  // Where the turbine stands (sun position, weather). Lawrence Weston / Avonmouth, Bristol.
  site: {
    lat: Number(env.SITE_LAT) || 51.52,
    lon: Number(env.SITE_LON) || -2.69,
  },

  weather: {
    apiKey: env.OPENWEATHER_API_KEY || "",
    baseUrl: (env.OPENWEATHER_BASE_URL || "https://api.openweathermap.org").replace(/\/$/, ""),
    refreshMs: Number(env.WEATHER_REFRESH_MS) || 10 * 60 * 1000, // free tier allows far more; 10 min is plenty
  },

  // Unsplash: photos shown in the chat. Only the access key is needed to search; the secret
  // key is for OAuth (user sign-in) which this app doesn't use, so it is never read.
  unsplash: {
    accessKey: env.UNSPLASH_ACCESS_KEY || "",
    baseUrl: (env.UNSPLASH_BASE_URL || "https://api.unsplash.com").replace(/\/$/, ""),
    timeoutMs: Number(env.UNSPLASH_TIMEOUT_MS) || 8000,
  },

  tavily: {
    apiKey: env.TAVILY_API_KEY || "",
    baseUrl: (env.TAVILY_BASE_URL || "https://api.tavily.com").replace(/\/$/, ""),
    timeoutMs: Number(env.TAVILY_TIMEOUT_MS) || 10_000,
  },
};
