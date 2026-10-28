// One private conversation per browser tab and screen.
//
// The server mints a signed session token; it lives in sessionStorage, so it survives a
// reload but disappears with the tab and is never shared with other tabs or people.
// Replies stream over SSE; history is restored from the server on reload.

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../lib/api.js";
import { readEventStream } from "../../lib/sse.js";

const storageKey = (screen) => `ww.chat.${screen}`;
let nextId = 1;
const id = () => `m${nextId++}`;

// Saved answers come back with their steps' timings; shape them like the streamed ones.
const savedSteps = (steps = []) =>
  steps.map((s, i) => ({
    id: `s${i}`,
    round: s.round,
    kind: s.kind,
    status: s.succeeded === false ? "failed" : "done",
    ms: s.startedAt && s.finishedAt ? new Date(s.finishedAt) - new Date(s.startedAt) : null,
  }));

// A step event either starts a step or finishes the one with the same id.
const upsertStep = (steps = [], step) =>
  steps.some((s) => s.id === step.id) ? steps.map((s) => (s.id === step.id ? { ...s, ...step } : s)) : [...steps, step];

function readToken(screen) {
  try {
    return sessionStorage.getItem(storageKey(screen));
  } catch {
    return null;
  }
}

function writeToken(screen, token) {
  try {
    if (token) sessionStorage.setItem(storageKey(screen), token);
    else sessionStorage.removeItem(storageKey(screen));
  } catch {
    // private mode: the token just lives in memory for this page view
  }
}

export function useChatSession(screen) {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("connecting"); // connecting | ready | streaming | error
  const [preview, setPreview] = useState(false);
  const token = useRef(null);
  const abort = useRef(null);

  const mint = useCallback(async () => {
    const s = await api.chatSession(screen);
    setPreview(Boolean(s.preview));
    token.current = s.token;
    writeToken(screen, s.token);
    return s.token;
  }, [screen]);

  // Restore this tab's conversation, or start a new one.
  useEffect(() => {
    let alive = true;
    (async () => {
      token.current = readToken(screen);
      try {
        if (token.current) {
          const h = await api.chatHistory(token.current);
          if (alive) setPreview(Boolean(h.preview));
          if (alive) setMessages(h.messages.map((m) => ({ id: id(), role: m.role, content: m.content, steps: savedSteps(m.steps), photos: m.photos })));
        } else {
          await mint();
        }
        if (alive) setStatus("ready");
      } catch (err) {
        if (err.status === 401) {
          // Expired or from an old server secret: quietly start fresh.
          try {
            await mint();
            if (alive) setStatus("ready");
            return;
          } catch {
            // fall through
          }
        }
        if (alive) setStatus("error");
      }
    })();
    return () => {
      alive = false;
      abort.current?.abort();
    };
  }, [screen, mint]);

  const patch = (msgId, fn) => setMessages((list) => list.map((m) => (m.id === msgId ? { ...m, ...fn(m) } : m)));

  const send = useCallback(
    async (text) => {
      const message = text.trim();
      if (!message || status === "streaming") return;
      const replyId = id();
      setMessages((list) => [
        ...list,
        { id: id(), role: "user", content: message },
        { id: replyId, role: "assistant", content: "", streaming: true },
      ]);
      setStatus("streaming");
      navigator.vibrate?.(8);

      const controller = new AbortController();
      abort.current = controller;
      const post = (t) =>
        fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
          body: JSON.stringify({ message }),
          signal: controller.signal,
        });

      try {
        let res = await post(token.current || (await mint()));
        if (res.status === 401) res = await post(await mint());
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          patch(replyId, () => ({ content: err.error || "I couldn't answer that just now.", error: true, streaming: false }));
          return;
        }
        await readEventStream(res, (event, data) => {
          if (event === "token") patch(replyId, (m) => ({ content: m.content + data.t, statusText: null }));
          else if (event === "status") patch(replyId, () => ({ statusText: data.s }));
          else if (event === "step") patch(replyId, (m) => ({ steps: upsertStep(m.steps, data) }));
          else if (event === "sources") patch(replyId, (m) => ({ sources: [...(m.sources || []), ...data.sources] }));
          else if (event === "photos") patch(replyId, (m) => ({ photos: [...(m.photos || []), ...data.photos] }));
          else if (event === "action") patch(replyId, (m) => ({ actions: [...(m.actions || []), data.action] }));
          else if (event === "error") patch(replyId, () => ({ content: data.error, error: true }));
        });
        patch(replyId, (m) => ({ streaming: false, statusText: null, content: m.content || (m.error ? m.content : "…") }));
      } catch (err) {
        if (controller.signal.aborted) patch(replyId, (m) => ({ streaming: false, statusText: null, content: m.content || "Stopped." }));
        else patch(replyId, () => ({ streaming: false, error: true, content: "Lost connection — please try again." }));
      } finally {
        abort.current = null;
        setStatus("ready");
      }
    },
    [status, mint]
  );

  const stop = useCallback(() => abort.current?.abort(), []);

  const reset = useCallback(async () => {
    abort.current?.abort();
    try {
      if (token.current) await api.chatReset(token.current);
    } catch {
      // the server forgets it after 30 minutes anyway
    }
    await mint().catch(() => {});
    setMessages([]);
    setStatus("ready");
  }, [mint]);

  return { messages, status, send, stop, reset, preview };
}
