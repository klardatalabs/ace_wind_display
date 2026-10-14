// Web search through Tavily, for facts that aren't in the turbine's data or the books.
// Results are cached for 15 minutes across instances (screens get the same questions all
// day, and Tavily is metered).

import { config } from "../config/index.js";
import { cached } from "../infra/cache.js";

export const webSearchEnabled = () => Boolean(config.tavily.apiKey);

/** @returns {Promise<{ answer?: string, results: Array<{ title: string, url: string, snippet: string }> }>} */
export async function webSearch(query) {
  const q = String(query).replace(/\s+/g, " ").trim().slice(0, 300);
  if (!q) return { results: [] };
  return cached(`tavily:${q.toLowerCase()}`, { freshSec: 15 * 60, staleSec: 45 * 60 }, async () => {
    const res = await fetch(`${config.tavily.baseUrl}/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.tavily.apiKey}` },
      body: JSON.stringify({ query: q, max_results: 5, search_depth: "basic", topic: "general", include_answer: "basic" }),
      signal: AbortSignal.timeout(config.tavily.timeoutMs),
    });
    if (!res.ok) throw new Error(`Web search responded ${res.status}`);
    const data = await res.json();
    return {
      answer: data.answer ? String(data.answer).slice(0, 700) : undefined,
      results: (data.results || []).map((r) => ({ title: r.title, url: r.url, snippet: String(r.content || "").replace(/\s+/g, " ").slice(0, 450) })),
    };
  });
}
