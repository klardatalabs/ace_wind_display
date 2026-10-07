// Tavily web search, for general wind-energy questions the project documents don't cover.
// Only offered to the model when TAVILY_API_KEY is set.

import { config } from "../../config/env.js";

export const definition = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the web for general wind energy or climate facts that are NOT about this specific turbine (e.g. 'how many wind turbines are in the UK'). Always cite the sources you use.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

export const isEnabled = () => Boolean(config.tavily.apiKey);

export async function run({ query = "" } = {}, ctx = {}) {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.tavily.apiKey}` },
      body: JSON.stringify({ query: String(query).slice(0, 300), max_results: 4, search_depth: "basic", topic: "general" }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { error: `Web search unavailable (${res.status})` };
    const data = await res.json();
    const results = (data.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: String(r.content || "").slice(0, 500),
    }));
    ctx.onSources?.(results.map(({ title, url }) => ({ title, url })));
    return { results };
  } catch (err) {
    return { error: `Web search failed: ${err.message}` };
  }
}
