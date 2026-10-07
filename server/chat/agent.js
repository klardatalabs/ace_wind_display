// Ace's reasoning loop: stream the model, run any tools it asks for, feed the results
// back, repeat until it answers. Falls back to templated answers without an LLM.

import { resolveProvider } from "./llm/provider.js";
import { streamCompletion } from "./llm/streamCompletion.js";
import { toolDefinitions, toolStatusText, runTool } from "./tools/index.js";
import { systemPrompt } from "./personas.js";
import { respondWithoutLlm } from "./fallbackResponder.js";
import { config } from "../config/env.js";

const MAX_TOOL_ROUNDS = 4;

/**
 * @param {object} p
 * @param {string} p.prompt
 * @param {Array<{role: string, content: string}>} p.history  this session's earlier turns only
 * @param {string} p.screen
 * @param {(t: string) => void} p.onText
 * @param {(s: string) => void} [p.onStatus]
 * @param {(s: object[]) => void} [p.onSources]
 * @param {(a: string) => void} [p.onAction]
 * @param {AbortSignal} [p.signal]
 * @returns {Promise<{ text: string, sources: object[] }>}
 */
export async function runAgent({ prompt, history, screen, onText, onStatus, onSources, onAction, signal }) {
  const sources = [];
  const ctx = {
    screen,
    signal,
    onText,
    onStatus,
    onAction,
    onSources: (s) => {
      sources.push(...s);
      onSources?.(s);
    },
  };

  const provider = resolveProvider();
  if (!provider) return { text: await respondWithoutLlm(prompt, ctx), sources };

  const messages = [
    { role: "system", content: systemPrompt(screen) },
    ...history.slice(-config.chat.maxContextMessages).map(({ role, content }) => ({ role, content })),
    { role: "user", content: prompt },
  ];

  let answer = "";
  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const tools = round < MAX_TOOL_ROUNDS ? toolDefinitions() : undefined;
      const { text, toolCalls } = await streamCompletion(provider, {
        messages,
        tools,
        signal,
        onText: (t) => {
          answer += t;
          onText(t);
        },
      });
      if (!toolCalls.length) break;

      messages.push({
        role: "assistant",
        content: text || null,
        tool_calls: toolCalls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.arguments || "{}" } })),
      });
      for (const call of toolCalls) {
        onStatus?.(toolStatusText(call.name));
        let args = {};
        try {
          args = JSON.parse(call.arguments || "{}");
        } catch {
          // model produced invalid JSON; run with no args
        }
        const result = await runTool(call.name, args, ctx);
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result).slice(0, 6000) });
      }
    }
  } catch (err) {
    if (signal?.aborted) return { text: answer, sources };
    console.warn("[chat] LLM failed, using fallback:", err.message);
    if (!answer) return { text: await respondWithoutLlm(prompt, ctx), sources };
  }
  return { text: answer, sources };
}
