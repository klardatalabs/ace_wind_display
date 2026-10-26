// "Ask Ace" — the phone chat opened from a hoarding's QR code (/ask/:screen).
// No login: each browser tab gets its own private, server-signed session.

import { useEffect, useRef, useState } from "react";
import { Navigate, useParams, useSearchParams } from "react-router";
import { useChatSession } from "./useChatSession.js";
import { ASK } from "../../content/ask.js";
import { SCREENS } from "../../content/screens.js";
import ChatHeader from "./components/ChatHeader.jsx";
import ResearchLibrary from "./components/ResearchLibrary.jsx";
import MessageBubble from "./components/MessageBubble.jsx";
import Composer from "./components/Composer.jsx";
import SuggestionChips from "./components/SuggestionChips.jsx";
import TurbineMark from "../../components/brand/TurbineMark.jsx";
import Icon from "../../components/ui/Icon.jsx";

export default function AskPage() {
  const { screen: param } = useParams();
  if (param && !ASK[param]) return <Navigate to="/ask/community" replace />;
  const screen = param || "community";
  return <Chat key={screen} screen={screen} />;
}

function Chat({ screen }) {
  const copy = ASK[screen];
  const screenName = SCREENS[screen].name;
  const { messages, status, send, stop, reset, preview } = useChatSession(screen);
  const [params, setParams] = useSearchParams();
  const asked = useRef(false);
  const bottom = useRef(null);
  const libraryButton = useRef(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const streaming = status === "streaming";

  useEffect(() => {
    document.title = `${copy.title} · Weston Wind`;
  }, [copy.title]);

  // A question tapped elsewhere (the landing page's question wall) arrives as ?q= and is
  // asked as soon as the session is ready. It's then dropped from the URL so a reload
  // doesn't ask it again.
  const preset = params.get("q")?.trim().slice(0, 600);
  useEffect(() => {
    if (!preset || asked.current || status !== "ready") return;
    asked.current = true;
    setParams((p) => {
      p.delete("q");
      return p;
    }, { replace: true });
    send(preset);
  }, [preset, status, send, setParams]);

  // Follow the conversation as replies stream in.
  const last = messages[messages.length - 1];
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, last?.content?.length]);

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-moss-25 to-moss-50">
      <ChatHeader title={copy.title} screenName={screenName} screen={screen} onReset={reset} canReset={messages.length > 0} onLibrary={() => setLibraryOpen(true)} libraryButtonRef={libraryButton} />
      <ResearchLibrary open={libraryOpen} onClose={() => setLibraryOpen(false)} triggerRef={libraryButton} />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 pt-5 pb-4 md:gap-5 md:px-6 md:pt-8" aria-live="polite">
        {preview && <p className="rounded-xl border border-moss-200 bg-white px-4 py-3 text-xs leading-relaxed text-moss-800">Local preview chat: sample explanations only. Live and source-backed answers need the production chat and research databases.</p>}
        <div className="flex items-end gap-2">
          <TurbineMark className="mb-1 size-8 shrink-0" />
          <div className="max-w-[85%] rounded-3xl rounded-bl-lg bg-white px-4 py-2.5 text-[15px] leading-relaxed text-moss-950 ring-1 ring-moss-100">
            {copy.greeting}
          </div>
        </div>

        {messages.length === 0 && !preset && status !== "error" && <SuggestionChips suggestions={copy.suggestions} onPick={send} disabled={status !== "ready"} />}

        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}

        {status === "error" && (
          <p className="rounded-2xl bg-white p-4 text-sm text-moss-800 ring-1 ring-moss-200">
            I can't reach the turbine's server right now. Check your connection and refresh the page.
          </p>
        )}
        <div ref={bottom} />
      </main>

      <footer className="sticky bottom-0 z-10 flex flex-col gap-2.5 bg-gradient-to-t from-moss-50 via-moss-50/95 to-transparent px-3 pt-6 pb-[max(env(safe-area-inset-bottom),12px)]">
        <Composer onSend={send} onStop={stop} streaming={streaming} disabled={status !== "ready"} />
        <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-moss-900/50">
          <Icon name="eye" className="size-3.5" />
          Private to this browser tab. Nothing you type is shown on the big screen.
        </p>
      </footer>
    </div>
  );
}
