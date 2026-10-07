// Picks the LLM endpoint from whichever key is configured. All supported providers
// speak the OpenAI chat-completions protocol, so one streaming client serves them all.

import { config } from "../../config/env.js";

const PRESETS = {
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4.1-mini" },
  groq: { baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  gemini: { baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash" },
};

/** @returns {{ name: string, baseUrl: string, apiKey: string, model: string } | null} */
export function resolveProvider() {
  const { llm } = config;
  if (llm.genericKey && llm.genericBaseUrl) {
    return { name: "custom", baseUrl: llm.genericBaseUrl.replace(/\/$/, ""), apiKey: llm.genericKey, model: llm.model || "default" };
  }
  const candidates = [
    ["openai", llm.openaiKey],
    ["groq", llm.groqKey],
    ["gemini", llm.geminiKey],
  ];
  for (const [name, apiKey] of candidates) {
    if (apiKey) return { name, apiKey, baseUrl: PRESETS[name].baseUrl, model: llm.model || PRESETS[name].model };
  }
  return null;
}
