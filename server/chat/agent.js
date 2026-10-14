// Ace's reasoning loop. Each round the model may ask for several tools at once (reading the
// books, searching the web, finding photos...); those run in parallel, and each becomes a
// step in the answer's activity graph, sent to the phone as it starts and finishes. Rounds
// repeat until the model answers (at most MAX_ROUNDS). Without a language model the
// templated fallback answers instead, using the same tools.

import { streamChat, llmEnabled } from "../integrations/llm.js";
import { toolDefinitions, toolByName } from "./tools/index.js";
import { systemPrompt } from "./personas.js";
import { respondWithoutLlm } from "./fallback.js";
import { config } from "../config/index.js";
import { AGENT_STEP_KINDS } from "../db/constants.js";
import { logger } from "../lib/logger.js";

const log = logger("chat.agent");
const MAX_ROUNDS = 4;
const TOOL_RESULT_CHARS = 8_000;

/** Runs one tool call as a graph step. Never throws: failures come back as data. */
export async function runStep({ name, args, round, id }, ctx) {
  const tool = toolByName(name);
  const kind = tool?.kind ?? null;
  const startedAt = new Date();
  const detail = typeof args?.query === "string" ? args.query.slice(0, 120) : args?.action ?? args?.period ?? null;
  ctx.emit("step", { id, round, kind, label: AGENT_STEP_KINDS[kind] ?? "Thinking", detail, status: "running" });
  let result;
  try {
    result = tool ? await tool.run(args ?? {}, ctx) : { error: `Unknown tool ${name}` };
  } catch (err) {
    log.warn("tool failed", { tool: name, err });
    result = { error: "This lookup failed; answer without it and say so if it matters." };
  }
  const succeeded = !result?.error && result?.ok !== false;
  const finishedAt = new Date();
  ctx.emit("step", { id, round, kind, label: AGENT_STEP_KINDS[kind] ?? "Thinking", detail, status: succeeded ? "done" : "failed", ms: finishedAt - startedAt });
  if (kind) ctx.steps.push({ round, kind, startedAt, finishedAt, succeeded });
  return result;
}

/**
 * @param {{ question: string, history: Array<{ role: string, content: string }>, screen: string,
 *   signal?: AbortSignal, emit: (event: string, data: object) => void }} p
 * @returns {Promise<{ content: string, steps: object[], photos: object[], actions: string[] }>}
 */
export async function runAgent({ question, history, screen, signal, emit }) {
  const ctx = {
    screen,
    emit,
    steps: [],
    photos: [],
    actions: [],
    addPhotos(photos) {
      ctx.photos.push(...photos);
      emit("photos", { photos: photos.map(({ downloadLocation, ...safe }) => safe) });
    },
    addAction(action) {
      ctx.actions.push(action);
      emit("action", { action });
    },
  };
  const result = (content) => ({ content, steps: ctx.steps, photos: ctx.photos, actions: ctx.actions });

  if (!llmEnabled) return result(await respondWithoutLlm(question, ctx, signal));

  const messages = [
    { role: "system", content: systemPrompt(screen) },
    ...history.slice(-config.chat.maxContextMessages).map(({ role, content }) => ({ role, content })),
    { role: "user", content: question },
  ];
  let answer = "";
  try {
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const { text, toolCalls } = await streamChat({
        messages,
        tools: round < MAX_ROUNDS ? toolDefinitions() : undefined,
        signal,
        onText: (t) => {
          answer += t;
          emit("token", { t });
        },
      });
      if (!toolCalls.length) break;
      messages.push({
        role: "assistant",
        content: text || null,
        tool_calls: toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.arguments || "{}" } })),
      });
      const outcomes = await Promise.all(
        toolCalls.map((call) => {
          let args = {};
          try {
            args = JSON.parse(call.arguments || "{}");
          } catch {
            // invalid JSON from the model: run the tool without arguments
          }
          return runStep({ name: call.name, args, round, id: call.id }, ctx);
        })
      );
      toolCalls.forEach((call, i) => messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(outcomes[i]).slice(0, TOOL_RESULT_CHARS) }));
    }
  } catch (err) {
    if (signal?.aborted) return result(answer);
    log.warn("language model failed; using the fallback", { err });
    if (!answer) return result(await respondWithoutLlm(question, ctx, signal));
  }
  return result(answer);
}
