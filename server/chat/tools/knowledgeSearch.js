// Search the reviewed, permitted research index.

import { searchKnowledge } from "../../knowledge/search.js";

export const kind = "knowledge_search";

export const definition = {
  type: "function",
  function: {
    name: "search_research",
    description: "Search permitted wind-energy research text. Use it for technical or research questions about wind resources, turbines, design, control and grid connection. Include a source title and URL in the answer when available.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "What to look up, e.g. 'how pitch control limits power'" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

export async function run({ query = "" } = {}, ctx) {
  const passages = await searchKnowledge(query, { limit: 5 });
  if (!passages.length) return { found: 0, note: "No relevant research passage was found; say so rather than inventing a citation." };
  const sources = [...new Map(passages.filter((p) => p.sourceUrl).map((p) => [p.sourceUrl, { title: p.title, url: p.sourceUrl, pages: p.pages }])).values()];
  if (sources.length) ctx?.emit("sources", { sources });
  return {
    found: passages.length,
    passages: passages.map((p) => ({ title: p.title, type: p.sourceType, sourceUrl: p.sourceUrl, pages: p.pages, text: p.content.slice(0, 1800) })),
  };
}
