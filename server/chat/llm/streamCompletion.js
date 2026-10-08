// Streams one chat-completions call (OpenAI-compatible SSE). Text deltas are forwarded
// as they arrive; tool-call fragments are stitched together and returned at the end.

import { config } from "../../config/env.js";

async function* sseEvents(body) {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let boundary;
    while ((boundary = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        yield JSON.parse(data);
      } catch {
        // partial or keep-alive line
      }
    }
  }
}

/**
 * @param {object} provider  from resolveProvider()
 * @param {{ messages: object[], tools?: object[], onText: (t: string) => void, signal?: AbortSignal }} opts
 * @returns {Promise<{ text: string, toolCalls: Array<{ id: string, name: string, arguments: string }> }>}
 */
export async function streamCompletion(provider, { messages, tools, onText, signal }) {
  // Abort if the provider hasn't sent response headers in time (or the visitor left).
  const connect = AbortSignal.timeout(config.llm.connectTimeoutMs);
  const controller = new AbortController();
  const abort = () => controller.abort();
  connect.addEventListener("abort", abort);
  signal?.addEventListener("abort", abort);

  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify({
      model: provider.model,
      messages,
      tools: tools?.length ? tools : undefined,
      tool_choice: tools?.length ? "auto" : undefined,
      temperature: config.llm.temperature,
      max_tokens: config.llm.maxTokens,
      stream: true,
    }),
    signal: controller.signal,
  });
  connect.removeEventListener("abort", abort);
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LLM ${provider.name} responded ${res.status}: ${detail.slice(0, 200)}`);
  }

  let text = "";
  const calls = new Map(); // index -> { id, name, arguments }
  for await (const event of sseEvents(res.body)) {
    const delta = event.choices?.[0]?.delta;
    if (!delta) continue;
    if (delta.content) {
      text += delta.content;
      onText(delta.content);
    }
    for (const tc of delta.tool_calls || []) {
      const idx = tc.index ?? 0;
      const entry = calls.get(idx) || { id: "", name: "", arguments: "" };
      if (tc.id) entry.id = tc.id;
      if (tc.function?.name) entry.name += tc.function.name;
      if (tc.function?.arguments) entry.arguments += tc.function.arguments;
      calls.set(idx, entry);
    }
  }
  const toolCalls = [...calls.values()].map((c, i) => ({ ...c, id: c.id || `call_${i}` }));
  return { text, toolCalls };
}
