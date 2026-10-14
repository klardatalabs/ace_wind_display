// Searches the web: for facts about this turbine, the project and the community, and for
// current events. Offered only when TAVILY_API_KEY is set.

import { webSearch, webSearchEnabled } from "../../integrations/tavily.js";

export const kind = "web_search";
export const isEnabled = webSearchEnabled;

export const definition = {
  type: "function",
  function: {
    name: "web_search",
    description: "Search the web. Use for facts about this turbine (who owns it, its history, planning, the Lawrence Weston community), current events and anything not in the books or the turbine's data. For questions about this turbine include 'Lawrence Weston Ambition Community Energy wind turbine' in the query.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", description: "A specific search query in English" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
};

export async function run({ query = "" } = {}) {
  const found = await webSearch(query);
  return { answer: found.answer, results: found.results.map(({ title, snippet }) => ({ title, snippet })) };
}
