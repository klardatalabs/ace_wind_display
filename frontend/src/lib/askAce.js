// A one-off question to Ace from a hoarding (the "Ask Ace more" button on a tapped item).
// Uses its own anonymous session, separate from any phone's chat, and streams the reply.

import { api } from "./api.js";
import { readEventStream } from "./sse.js";

const tokens = new Map();

async function tokenFor(screen) {
  if (!tokens.has(screen)) tokens.set(screen, (await api.chatSession(screen)).token);
  return tokens.get(screen);
}

/**
 * @param {string} screen
 * @param {string} question
 * @param {{ onToken?: (t: string) => void, onPhotos?: (p: any[]) => void, onStatus?: (s: string) => void, signal?: AbortSignal }} handlers
 * @returns {Promise<string>} the full reply
 */
export async function askAce(screen, question, { onToken, onPhotos, onStatus, signal } = {}) {
  const post = async (t) =>
    fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify({ message: question }),
      signal,
    });
  let res = await post(await tokenFor(screen));
  if (res.status === 401) {
    tokens.delete(screen);
    res = await post(await tokenFor(screen));
  }
  if (!res.ok) throw new Error("Ace couldn't answer just now.");
  let text = "";
  await readEventStream(res, (event, data) => {
    if (event === "token") {
      text += data.t;
      onToken?.(text);
    } else if (event === "photos") onPhotos?.(data.photos);
    else if (event === "status") onStatus?.(data.s);
    else if (event === "error") throw new Error(data.error);
  });
  return text;
}
