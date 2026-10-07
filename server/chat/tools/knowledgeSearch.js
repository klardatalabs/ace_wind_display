import { knowledgeBase } from "../../knowledge/knowledgeBase.js";

export const definition = {
  type: "function",
  function: {
    name: "search_knowledge",
    description:
      "Search Weston Wind's own documents: who owns the turbine, how it works, specs, the open data, the API, how impact numbers are calculated. Use before answering factual questions about the project.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "What to look up, in plain words" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

export async function run({ query = "" } = {}) {
  const results = knowledgeBase.search(String(query).slice(0, 200), 4);
  return results.length ? { results } : { results: [], note: "Nothing relevant in the project documents." };
}
