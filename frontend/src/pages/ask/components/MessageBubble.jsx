// One chat message. Bubbles spring in; Ace's reply streams word by word with a caret,
// shows what it's doing ("Reading my live sensors…") and any sources or screen actions.

import { useRef } from "react";
import { gsap, useGSAP } from "../../../lib/gsap.js";
import { prefersReducedMotion } from "../../../hooks/useReducedMotion.js";
import { Markdown } from "../../../lib/markdown.jsx";
import TurbineMark from "../../../components/brand/TurbineMark.jsx";
import Icon from "../../../components/ui/Icon.jsx";
import TypingDots from "./TypingDots.jsx";
import PhotoStrip from "./PhotoStrip.jsx";

const ACTION_TEXT = {
  look_inside: "Opened the turbine on the big screen",
  tower_inside: "Showing inside the tower on the big screen",
  close_inside: "Closed the turbine on the big screen",
  fly_to_nacelle: "Flew the big screen up to the nacelle",
  fly_to_base: "Took the big screen down to the base",
  overview: "Zoomed the big screen out",
  spin_blades: "Gave the blades a spin on the big screen",
};

export default function MessageBubble({ message }) {
  const ref = useRef(null);
  const mine = message.role === "user";

  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from(ref.current, {
        y: 14,
        opacity: 0,
        scale: 0.96,
        transformOrigin: mine ? "100% 100%" : "0% 100%",
        duration: 0.5,
        ease: "back.out(1.7)",
      });
    },
    { scope: ref }
  );

  if (mine) {
    return (
      <div ref={ref} className="flex justify-end">
        <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-gradient-to-b from-moss-700 to-moss-900 px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-white shadow-[0_6px_20px_rgb(10_21_29/0.18)]">
          {message.content}
        </div>
      </div>
    );
  }

  const waiting = message.streaming && !message.content;
  return (
    <div ref={ref} className="flex items-end gap-2">
      <TurbineMark className="mb-1 size-8 shrink-0" />
      <div className="max-w-[85%] min-w-0">
        <PhotoStrip photos={message.photos} />
        <div
          className={`rounded-3xl rounded-bl-lg px-4 py-2.5 text-[15px] leading-relaxed shadow-[0_6px_20px_rgb(10_21_29/0.06)] ${
            message.error ? "bg-moss-50 text-moss-900 ring-1 ring-moss-200" : "bg-white text-moss-950 ring-1 ring-moss-100"
          }`}
        >
          {waiting ? (
            <div className="flex items-center gap-2 py-1 text-sm text-moss-700">
              <TypingDots />
              {message.statusText && <span className="animate-pulse">{message.statusText}</span>}
            </div>
          ) : (
            <div className={message.streaming ? "stream-caret" : ""}>
              <Markdown text={message.content} />
            </div>
          )}
          {message.streaming && message.content && message.statusText && <p className="mt-1 animate-pulse text-xs text-moss-600">{message.statusText}</p>}
        </div>
        {message.actions?.map((a, i) => (
          <p key={i} className="mt-1.5 ml-2 flex items-center gap-1.5 text-xs font-medium text-moss-600">
            <Icon name="eye" className="size-3.5" />
            {ACTION_TEXT[a] ?? "Moved the big screen"}
          </p>
        ))}
        {!message.streaming && message.sources?.length > 0 && (
          <div className="mt-1.5 ml-2 flex flex-wrap gap-1.5">
            {dedupe(message.sources).slice(0, 4).map((s, i) =>
              s.url ? (
                <a key={i} href={s.url} target="_blank" rel="noreferrer" className="rounded-full bg-moss-50 px-2.5 py-1 text-[11px] text-moss-700 ring-1 ring-moss-100 hover:bg-moss-100">
                  {s.title || hostOf(s.url)}
                </a>
              ) : (
                <span key={i} className="rounded-full bg-moss-50 px-2.5 py-1 text-[11px] text-moss-700 ring-1 ring-moss-100">
                  {s.title || s.heading || s.source}
                </span>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function dedupe(sources) {
  const seen = new Set();
  return sources.filter((s) => {
    const k = s.url || s.title || s.heading || s.source;
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}
