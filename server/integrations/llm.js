// Language models through the OpenAI SDK. Any OpenAI-compatible endpoint works (OpenAI,
// Anthropic's compatibility endpoint, Groq, Together, a local Ollama or vLLM server...):
// set LLM_BASE_URL, LLM_API_KEY and LLM_MODEL. Claude is used through Anthropic's
// OpenAI-compatible endpoint. Embeddings use EMBEDDING_* (by default a local model server,
// since Claude has no embeddings endpoint).

import OpenAI from "openai";
import { config, llmEnabled, embeddingsEnabled } from "../config/index.js";

export { llmEnabled, embeddingsEnabled };

const chatClient = llmEnabled
  ? new OpenAI({ baseURL: config.llm.baseUrl, apiKey: config.llm.apiKey, maxRetries: 1, timeout: 60_000 })
  : null;
const embeddingClient = embeddingsEnabled
  ? new OpenAI({ baseURL: config.embeddings.baseUrl, apiKey: config.embeddings.apiKey, maxRetries: 3, timeout: 60_000 })
  : null;

/**
 * Streams one chat completion. Text deltas go to `onText` as they arrive; tool-call
 * fragments are stitched together and returned at the end. Aborts when the provider is
 * silent for LLM_IDLE_TIMEOUT_MS, before or during the stream.
 *
 * @returns {Promise<{ text: string, toolCalls: Array<{ id: string, name: string, arguments: string }> }>}
 */
export async function streamChat({ messages, tools, onText, signal }) {
  if (!chatClient) throw new Error("No language model is configured");
  const idle = new AbortController();
  let timer;
  const touch = () => {
    clearTimeout(timer);
    timer = setTimeout(() => idle.abort(new Error("The language model stopped responding")), config.llm.idleTimeoutMs);
  };
  const combined = signal ? AbortSignal.any([signal, idle.signal]) : idle.signal;
  touch();
  try {
    const stream = await chatClient.chat.completions.create(
      {
        model: config.llm.model,
        messages,
        tools: tools?.length ? tools : undefined,
        tool_choice: tools?.length ? "auto" : undefined,
        ...(config.llm.temperature === undefined ? {} : { temperature: config.llm.temperature }),
        max_tokens: config.llm.maxTokens,
        stream: true,
      },
      { signal: combined }
    );
    let text = "";
    const calls = new Map(); // index -> { id, name, arguments }
    for await (const chunk of stream) {
      touch();
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.content) {
        text += delta.content;
        onText?.(delta.content);
      }
      for (const tc of delta.tool_calls ?? []) {
        const entry = calls.get(tc.index ?? 0) ?? { id: "", name: "", arguments: "" };
        if (tc.id) entry.id = tc.id;
        if (tc.function?.name) entry.name += tc.function.name;
        if (tc.function?.arguments) entry.arguments += tc.function.arguments;
        calls.set(tc.index ?? 0, entry);
      }
    }
    return { text, toolCalls: [...calls.values()].map((c, i) => ({ ...c, id: c.id || `call_${i}` })) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One whole reply, not streamed, for background jobs. `maxTokens` must leave room for the
 * model's thinking, which counts towards it.
 * @returns {Promise<string>}
 */
export async function completeChat({ messages, maxTokens = 8_000, signal }) {
  if (!chatClient) throw new Error("No language model is configured");
  const reply = await chatClient.chat.completions.create({ model: config.llm.model, messages, max_tokens: maxTokens }, { signal: signal ?? AbortSignal.timeout(120_000) });
  const choice = reply.choices?.[0];
  if (choice?.finish_reason === "length") throw new Error("The reply was cut off at the token limit");
  return choice?.message?.content ?? "";
}

/** Embeds a search query (with the model's query instruction, if it has one). */
export async function embedQuery(text) {
  const [vector] = await embed([`${config.embeddings.queryPrefix}${text}`]);
  return vector;
}

/**
 * Embeds `inputs` in batches. Sends `dimensions` only when EMBEDDING_DIMENSIONS is set
 * (not every provider accepts it); otherwise the model's native size is used.
 * @returns {Promise<number[][]>}
 */
export async function embed(inputs) {
  if (!embeddingClient) throw new Error("No embedding model is configured");
  const out = [];
  for (let i = 0; i < inputs.length; i += config.embeddings.batchSize) {
    const batch = inputs.slice(i, i + config.embeddings.batchSize);
    const res = await embeddingClient.embeddings.create({
      model: config.embeddings.model,
      input: batch,
      ...(config.embeddings.dimensions ? { dimensions: config.embeddings.dimensions } : {}),
    });
    const ordered = [...res.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
    if (ordered.length !== batch.length) throw new Error("Embedding provider returned the wrong number of vectors");
    out.push(...ordered);
  }
  return out;
}
