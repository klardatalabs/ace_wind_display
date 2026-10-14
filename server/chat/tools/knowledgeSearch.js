// Reads the books in the knowledge base (hybrid search). The best source for explaining how
// wind turbines and wind energy work.

import { searchKnowledge } from "../../knowledge/search.js";

export const kind = "knowledge_search";

export const definition = {
  type: "function",
  function: {
    name: "search_books",
    description: "Search the wind-energy textbooks in the knowledge base (aerodynamics, turbine design, the wind resource, generators, control, loads, grid connection). Use it for any question about how wind turbines or wind energy work, with a short, specific query in English.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "What to look up, e.g. 'how pitch control limits power'" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

export async function run({ query = "" } = {}) {
  const passages = await searchKnowledge(query, { limit: 5 });
  if (!passages.length) return { found: 0, note: "Nothing relevant in the books; rely on other sources or say so." };
  return {
    found: passages.length,
    passages: passages.map((p) => ({ book: p.title, pages: p.pages, text: p.content.slice(0, 1800) })),
  };
}
