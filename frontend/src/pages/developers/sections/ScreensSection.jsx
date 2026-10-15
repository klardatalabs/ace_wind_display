// How the big screens connect, for developers: the screen URLs, the WebSocket a screen holds
// open (live state, weather and animation commands), and how a visitor's phone, through the
// chat session the QR code opens, can ask its screen to play one of a fixed set of
// animations. The actions and cooldowns are the server's own (shared/screens.js,
// server/api/services/screens.js); chat text never travels to a screen.

import { useEffect, useState } from "react";
import SectionHeading from "../../../components/ui/SectionHeading.jsx";
import CodeBlock from "../../../components/ui/CodeBlock.jsx";
import Icon from "../../../components/ui/Icon.jsx";
import { SCREENS, SCREEN_ACTIONS } from "@shared/screens.js";
import { api } from "../../../lib/api.js";

const STEPS = [
  { icon: "layers", title: "1 · Open a screen", text: "Each hoarding is just a web page. Open it full-screen on any display or kiosk browser: it loads the 3D turbine and tells its story on a loop." },
  { icon: "plug", title: "2 · It connects itself", text: "The page opens a WebSocket to /ws, subscribes with its screen id, and from then on gets live telemetry, the weather and animation commands pushed to it." },
  { icon: "qrcode", title: "3 · Phones join through the QR", text: "The QR on the screen opens /ask/<screen>. That chat session belongs to that screen, so a visitor can ask it to play an animation, never to show text." },
];

const screenSample = (ws) => `// Listen exactly as a big screen does.
const socket = new WebSocket("${ws}/ws");

socket.onopen = () => {
  // Say which screen you are: students, community, college or story.
  socket.send(JSON.stringify({ type: "screen.subscribe", screen: "community" }));
};

socket.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "state") console.log("live", msg.state.now.activePowerKw, "kW");
  if (msg.type === "environment") console.log("weather", msg.environment);
  if (msg.type === "screen.subscribed") console.log("subscribed to", msg.screen);
  if (msg.type === "screen.command") console.log("play", msg.action, msg.value ?? "");
};`;

const phoneSample = (origin) => `// What a visitor's phone does after scanning the QR.
// 1. A chat session that belongs to that screen.
const { token } = await fetch("${origin}/api/chat/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ screen: "community" }),
}).then((r) => r.json());

// 2. Ask that screen to play one of the fixed animations.
const res = await fetch("${origin}/api/screens/command", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: \`Bearer \${token}\` },
  body: JSON.stringify({ action: "look_inside" }),
});
console.log(res.status, await res.json()); // 409 if the screen is busy or not connected`;

export default function ScreensSection({ origin }) {
  const ws = origin.replace(/^http/, "ws");
  const [connected, setConnected] = useState(null);
  useEffect(() => {
    api
      .screens()
      .then((r) => setConnected(r?.connected ?? r?.screens ?? null))
      .catch(() => {});
  }, []);

  return (
    <section id="screens" className="scroll-mt-28 bg-moss-25 px-6 py-20 md:px-12 xl:px-36">
      <div className="mx-auto max-w-[1280px]">
        <SectionHeading eyebrow="The big screens" title="Connect to the hoardings.">
          The screens on the hoardings are web pages that hold a live connection to the server. You can open one, listen to the same feed, or trigger its animations the way a visitor's phone does.
        </SectionHeading>

        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.title} className="rounded-2xl bg-white p-5 ring-1 ring-moss-100">
              <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-moss-50 text-moss-600">
                <Icon name={s.icon} className="size-6" />
              </span>
              <p className="font-display text-lg font-semibold text-moss-950">{s.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-moss-900/75">{s.text}</p>
            </li>
          ))}
        </ol>

        <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-6">
            <div>
              <h3 className="font-display text-xl font-semibold text-moss-950">The screens</h3>
              <ul className="mt-3 space-y-2">
                {SCREENS.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl bg-white px-4 py-3 ring-1 ring-moss-100">
                    <a href={`/screen/${s.id}`} target="_blank" rel="noreferrer" className="font-medium text-moss-900 underline-offset-4 hover:underline">
                      {s.title}
                    </a>
                    <span className="font-mono text-xs break-all text-moss-700">
                      /screen/{s.id} · chat /ask/{s.id}
                      {connected && typeof connected[s.id] === "number" ? ` · ${connected[s.id]} open now` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold text-moss-950">Animations a phone can trigger</h3>
              <ul className="mt-3 space-y-1.5 text-sm">
                {Object.entries(SCREEN_ACTIONS).map(([id, about]) => (
                  <li key={id} className="flex gap-3">
                    <code className="shrink-0 rounded bg-white px-1.5 py-0.5 font-mono text-xs text-moss-800 ring-1 ring-moss-100">{id}</code>
                    <span className="text-moss-900/75">{about}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 rounded-xl bg-white p-3 text-xs leading-relaxed text-moss-900/70 ring-1 ring-moss-100">
                Only these fixed actions ever reach a screen: nothing a visitor types is shown or broadcast. A screen plays one animation at a time with a short cooldown so visitors take turns, each chat session is rate-limited, and <code>walk_to</code> takes a value from 0 (the tower door) to 1 (the machine room).
              </p>
            </div>
          </div>
          <div className="min-w-0 space-y-6">
            <CodeBlock title="screen.js · listen like a hoarding" code={screenSample(ws)} />
            <CodeBlock title="phone.js · trigger an animation" code={phoneSample(origin)} />
          </div>
        </div>
      </div>
    </section>
  );
}
