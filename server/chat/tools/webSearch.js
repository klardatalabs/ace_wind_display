// Tavily web search: where Ace gets facts about the turbine, the project, the community
// and wind energy in general. Live numbers come from the other tools, never from here.
// Only offered to the model when TAVILY_API_KEY is set.

import { config } from "../../config/env.js";

export const definition = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the web. Use this for ANY factual question that is not live telemetry or generation history: the turbine's size, who owns it, how it was built, the Lawrence Weston community, planning and funding, how wind turbines work, climate and energy facts. For questions about this turbine include 'Lawrence Weston Ambition Community Energy wind turbine' in the query. Cite the sources you use.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "A specific search query, in English" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

export const isEnabled = () => Boolean(config.tavily.apiKey);

// Small in-memory cache: hoardings get the same handful of questions all day, and Tavily
// is metered. Entries expire after 15 minutes.
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_MAX = 200;
const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key, value) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), value });
}

export async function run({ query = "" } = {}, ctx = {}) {
  const q = String(query).replace(/\s+/g, " ").trim().slice(0, 300);
  if (!q) return { error: "Empty query" };
  const key = q.toLowerCase();

  let value = cacheGet(key);
  if (!value) {
    try {
      const res = await fetch(`${config.tavily.baseUrl}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.tavily.apiKey}` },
        body: JSON.stringify({ query: q, max_results: 5, search_depth: "basic", topic: "general", include_answer: "basic" }),
        signal: AbortSignal.timeout(config.tavily.timeoutMs),
      });
      if (!res.ok) return { error: `Web search unavailable (${res.status})` };
      const data = await res.json();
      value = {
        answer: data.answer ? String(data.answer).slice(0, 700) : undefined,
        results: (data.results || []).map((r) => ({
          title: r.title,
          url: r.url,
          snippet: String(r.content || "").replace(/\s+/g, " ").slice(0, 450),
        })),
      };
      if (value.results.length || value.answer) cacheSet(key, value);
    } catch (err) {
      return { error: `Web search failed: ${err.message}` };
    }
  }

  ctx.onSources?.(value.results.slice(0, 4).map(({ title, url }) => ({ title, url })));
  return value;
}
