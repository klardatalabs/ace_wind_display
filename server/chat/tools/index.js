// The agent's tools: what Ace can look up or do. Each tool module exports `definition` (the
// function schema), `kind` (its step in the answer's activity graph), `run(args, ctx)` and
// optionally `isEnabled()`.

import * as liveStatus from "./liveStatus.js";
import * as generationHistory from "./generationHistory.js";
import * as knowledgeSearch from "./knowledgeSearch.js";
import * as webSearch from "./webSearch.js";
import * as showPhotos from "./showPhotos.js";
import * as bigScreen from "./bigScreen.js";

const ALL = [liveStatus, generationHistory, knowledgeSearch, webSearch, showPhotos, bigScreen];

export const enabledTools = () => ALL.filter((t) => (t.isEnabled ? t.isEnabled() : true));
export const toolDefinitions = () => enabledTools().map((t) => t.definition);
export const toolByName = (name) => enabledTools().find((t) => t.definition.function.name === name);

export { liveStatus, generationHistory, knowledgeSearch, webSearch, showPhotos, bigScreen };
