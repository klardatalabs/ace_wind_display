// Message box: grows with the text, Enter sends (Shift+Enter for a new line), and the
// send button morphs into a stop button while Ace is answering.

import { useEffect, useRef, useState } from "react";
import Icon from "../../../components/ui/Icon.jsx";

const MAX = 600;

export default function Composer({ onSend, onStop, streaming, disabled }) {
  const [text, setText] = useState("");
  const area = useRef(null);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  const submit = (e) => {
    e?.preventDefault();
    if (streaming) return onStop();
    if (!text.trim() || disabled) return;
    onSend(text);
    setText("");
  };

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-2xl items-end gap-2 rounded-[26px] bg-white p-1.5 pl-4 shadow-[0_8px_30px_rgb(6_33_26/0.1)] ring-1 ring-moss-100 focus-within:ring-2 focus-within:ring-moss-300">
      <label htmlFor="ask-input" className="sr-only">
        Your question
      </label>
      <textarea
        id="ask-input"
        ref={area}
        rows={1}
        value={text}
        maxLength={MAX}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
        }}
        placeholder="Ask the turbine anything…"
        enterKeyHint="send"
        className="max-h-[140px] flex-1 resize-none bg-transparent py-2.5 text-base text-moss-950 outline-none placeholder:text-moss-900/40"
      />
      {text.length > MAX - 80 && <span className="self-center font-mono text-[11px] text-moss-600">{MAX - text.length}</span>}
      <button
        type="submit"
        disabled={!streaming && (!text.trim() || disabled)}
        aria-label={streaming ? "Stop answering" : "Send"}
        className={`flex size-11 shrink-0 items-center justify-center rounded-full text-white transition-all duration-300 ease-[var(--ease-spring)] active:scale-90 disabled:opacity-35 ${
          streaming ? "rotate-0 bg-moss-600" : "bg-gradient-to-b from-moss-700 to-moss-950 hover:-rotate-12"
        }`}
      >
        {streaming ? <span className="size-3.5 rounded-sm bg-white" /> : <Icon name="arrowRight" className="size-5 -rotate-90" />}
      </button>
    </form>
  );
}
