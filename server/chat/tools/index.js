// Tool registry: what Ace can look up or do, and a single entry point to run a tool.

import * as liveStatus from "./liveStatus.js";
import * as generationHistory from "./generationHistory.js";
import * as webSearch from "./webSearch.js";
import * as bigScreen from "./bigScreen.js";

const ALL = [liveStatus, generationHistory, webSearch, bigScreen];

const STATUS_TEXT = {
  get_live_status: "Reading my live sensors…",
  get_generation_history: "Checking my history…",
  web_search: "Searching the web for that…",
  show_on_big_screen: "Moving the big screen…",
};

const isWebSearchEnabled = () => webSearch.isEnabled();

function enabledTools() {
  return ALL.filter((t) => (t.isEnabled ? t.isEnabled() : true));
}

export function toolDefinitions() {
  return enabledTools().map((t) => t.definition);
}

export function toolStatusText(name) {
  return STATUS_TEXT[name] || "Thinking…";
}

/** Runs a tool by name. Never throws: errors come back as data the model can explain. */
export async function runTool(name, args, ctx) {
  const tool = enabledTools().find((t) => t.definition.function.name === name);
  if (!tool) return { error: `Unknown tool ${name}` };
  try {
    return await tool.run(args || {}, ctx);
  } catch (err) {
    return { error: err.message };
  }
}

export { liveStatus, generationHistory, webSearch, isWebSearchEnabled };
