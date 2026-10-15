// Typed configuration for every process (api, collector, CLIs). Validated once at startup:
// in production a missing secret or service URL stops the process instead of running with
// an unsafe default.

import { loadDotEnv, env } from "./dotenv.js";

loadDotEnv();

const production = env.string("NODE_ENV", "development") === "production";

export const config = {
  production,
  logLevel: env.string("LOG_LEVEL", production ? "info" : "debug"),
  instanceId: env.string("INSTANCE_ID", `${process.pid}`),

  http: {
    port: env.int("PORT", 4100),
    // Public origin used in QR codes and emailed links. Never derived from request headers.
    publicOrigin: env.string("PUBLIC_ORIGIN", production ? "" : "http://localhost:5173").replace(/\/$/, ""),
    // Express "trust proxy": by default trust the private hops (host nginx -> load balancer).
    trustProxy: env.string("TRUST_PROXY", "loopback, linklocal, uniquelocal"),
    shutdownGraceMs: env.int("SHUTDOWN_GRACE_MS", 15_000),
  },

  postgres: {
    host: env.string("PGHOST", "127.0.0.1"),
    port: env.int("PGPORT", 5432),
    user: env.string("PGUSER", "ace"),
    password: env.string("PGPASSWORD"),
    database: env.string("PGDATABASE", "ace_wind"),
    poolSize: env.int("PG_POOL_SIZE", 10),
    statementTimeoutMs: env.int("PG_STATEMENT_TIMEOUT_MS", 15_000),
  },

  redis: {
    url: env.string("REDIS_URL", "redis://127.0.0.1:6379"),
    keyPrefix: env.string("REDIS_KEY_PREFIX", "ww:"),
  },

  ace: {
    baseUrl: env.string("ACE_API_BASE", "https://ace-api.duckdns.org").replace(/\/$/, ""),
    timeoutMs: env.int("ACE_TIMEOUT_MS", 10_000),
    // ACE allows 1 s data to be read at most once a second, but polling that fast it still
    // turned away a few percent of requests (HTTP 429). The screens smooth live figures
    // over ~20 s, so every 2 s loses nothing and is kinder to the community API.
    livePollMs: env.int("ACE_LIVE_POLL_MS", 2_000),
    statusPollMs: env.int("ACE_STATUS_POLL_MS", 5_000),
    historySyncMs: env.int("HISTORY_SYNC_MS", 10 * 60_000),
    // Keep this many years of history (never earlier than commissioning). HISTORY_START, when
    // set, overrides it with an exact start.
    historyYears: env.int("HISTORY_YEARS", 4),
    historyStart: env.string("HISTORY_START"),
    // Re-read this much recent history on every sync, so revised values are corrected.
    historyLookbackMs: env.int("HISTORY_LOOKBACK_HOURS", 24) * 3_600_000,
    zenodoCheckMs: env.int("ZENODO_CHECK_HOURS", 24) * 3_600_000,
  },

  weather: {
    apiKey: env.string("OPENWEATHER_API_KEY"),
    baseUrl: env.string("OPENWEATHER_BASE_URL", "https://api.openweathermap.org").replace(/\/$/, ""),
    refreshMs: env.int("WEATHER_REFRESH_MS", 10 * 60_000),
    // A reading older than this is reported as stale and never shown as current.
    staleAfterMs: env.int("WEATHER_STALE_MINUTES", 45) * 60_000,
  },

  // Any OpenAI-compatible chat endpoint (OpenAI, Groq, a local server...), through the OpenAI
  // SDK. With only ANTHROPIC_API_KEY set, Claude is used through Anthropic's
  // OpenAI-compatible endpoint.
  llm: {
    baseUrl: env.string("LLM_BASE_URL") || (env.string("ANTHROPIC_API_KEY") ? "https://api.anthropic.com/v1/" : ""),
    apiKey: env.string("LLM_API_KEY") || env.string("ANTHROPIC_API_KEY"),
    model: env.string("LLM_MODEL") || (env.string("ANTHROPIC_API_KEY") ? "claude-haiku-5-5" : ""),
    // Only sent when set: current Claude models reject non-default sampling parameters.
    temperature: env.string("LLM_TEMPERATURE") ? env.number("LLM_TEMPERATURE") : undefined,
    maxTokens: env.int("LLM_MAX_TOKENS", 1_500),
    // Abort when the provider sends nothing for this long (before or during the stream).
    idleTimeoutMs: env.int("LLM_IDLE_TIMEOUT_MS", 45_000),
  },

  // Embeddings for the knowledge base: any OpenAI-compatible /v1/embeddings endpoint. The
  // default deployment runs a local model (text-embeddings-inference) that needs no key.
  embeddings: {
    baseUrl: env.string("EMBEDDING_BASE_URL"),
    apiKey: env.string("EMBEDDING_API_KEY", "not-needed-for-local-models"),
    model: env.string("EMBEDDING_MODEL"),
    // 0 = the model's native size. Only providers that support it (e.g. OpenAI) accept a value.
    dimensions: env.int("EMBEDDING_DIMENSIONS", 0),
    batchSize: env.int("EMBEDDING_BATCH_SIZE", 32),
    // Some retrieval models expect queries (not passages) to start with an instruction.
    queryPrefix: env.string("EMBEDDING_QUERY_PREFIX"),
  },

  chat: {
    sessionSecret: env.string("CHAT_SESSION_SECRET"),
    retentionDays: env.int("CHAT_RETENTION_DAYS", 30),
    maxContextMessages: 12,
    maxMessageChars: 600,
    screenCommandCooldownSec: 12,
  },

  datasets: {
    tokenSecret: env.string("DATASET_TOKEN_SECRET"),
    linkTtlHours: env.int("DATASET_LINK_TTL_HOURS", 24),
    resendApiKey: env.string("RESEND_API_KEY"),
    emailFrom: env.string("DATASET_EMAIL_FROM", "ACE Wind Turbine <datasets@acewind.org>"),
  },

  tavily: {
    apiKey: env.string("TAVILY_API_KEY"),
    baseUrl: env.string("TAVILY_BASE_URL", "https://api.tavily.com").replace(/\/$/, ""),
    timeoutMs: env.int("TAVILY_TIMEOUT_MS", 10_000),
  },

  unsplash: {
    accessKey: env.string("UNSPLASH_ACCESS_KEY"),
    baseUrl: env.string("UNSPLASH_BASE_URL", "https://api.unsplash.com").replace(/\/$/, ""),
    timeoutMs: env.int("UNSPLASH_TIMEOUT_MS", 8_000),
  },

  dataDir: env.string("DATA_DIR", "data"),
};

const llmParts = [config.llm.baseUrl, config.llm.apiKey, config.llm.model];
// Partial LLM_* settings are a mistake worth stopping for; ANTHROPIC_API_KEY alone fills all three.
export const llmEnabled = llmParts.every(Boolean);
export const embeddingsEnabled = Boolean(config.embeddings.baseUrl && config.embeddings.model);

/** Throws on settings that would make the process unsafe or broken. */
export function validateConfig(c = config) {
  const problems = [];
  const secret = (name, value) => {
    if (!value || value.length < 32) problems.push(`${name} must be set to at least 32 random characters`);
  };
  if (llmParts.some(Boolean) && !llmEnabled) problems.push("LLM_BASE_URL, LLM_API_KEY and LLM_MODEL must be set together");
  if (c.embeddings.dimensions < 0 || c.embeddings.dimensions > 4000) problems.push("EMBEDDING_DIMENSIONS must be between 0 (native) and 4000");
  if (c.production) {
    secret("CHAT_SESSION_SECRET", c.chat.sessionSecret);
    secret("DATASET_TOKEN_SECRET", c.datasets.tokenSecret);
    if (!c.postgres.password) problems.push("PGPASSWORD must be set");
    if (!/^https:\/\//.test(c.http.publicOrigin)) problems.push("PUBLIC_ORIGIN must be the site's https:// origin");
    if (!/^rediss?:\/\/[^@]*:[^@]+@/.test(c.redis.url)) problems.push("REDIS_URL must include the Redis password");
  }
  if (problems.length) throw new Error(`Invalid configuration:\n  - ${problems.join("\n  - ")}`);
  return c;
}

// Development defaults so the app runs out of the box; production must set real secrets.
if (!config.production) {
  config.chat.sessionSecret ||= "dev-only-chat-session-secret-change-me-0000";
  config.datasets.tokenSecret ||= "dev-only-dataset-token-secret-change-me-000";
}
