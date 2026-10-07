import { useState } from "react";
import SectionHeading from "../../../components/ui/SectionHeading.jsx";
import CodeBlock from "../../../components/ui/CodeBlock.jsx";

const samples = (origin) => {
  const ws = origin.replace(/^http/, "ws");
  return [
    {
      id: "live",
      label: "Live stream",
      title: "live.js",
      code: `// Every state change, pushed as it happens.
const socket = new WebSocket("${ws}/ws");

socket.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type !== "state") return;
  const { activePowerKw, windSpeed, rotorRpm } = msg.state.now;
  console.log(\`\${activePowerKw} kW at \${windSpeed} m/s, rotor \${rotorRpm} rpm\`);
};`,
    },
    {
      id: "chat",
      label: "Streaming chat",
      title: "ask-ace.js",
      code: `// 1. Get an anonymous session (one per user / tab).
const { token } = await fetch("${origin}/api/chat/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ screen: "college" }),
}).then((r) => r.json());

// 2. Ask a question; the answer streams back as Server-Sent Events.
const res = await fetch("${origin}/api/chat/stream", {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: \`Bearer \${token}\` },
  body: JSON.stringify({ message: "What's the capacity factor this week?" }),
});

const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
for (;;) {
  const { value, done } = await reader.read();
  if (done) break;
  for (const frame of value.split("\\n\\n")) {
    const event = frame.match(/^event: (.+)$/m)?.[1];
    const data = frame.match(/^data: (.+)$/m)?.[1];
    if (event === "token") process.stdout.write(JSON.parse(data).t);
  }
}`,
    },
    {
      id: "python",
      label: "Python + Parquet",
      title: "analysis.py",
      code: `import pandas as pd
import requests

# Live snapshot
now = requests.get("${origin}/api/state").json()["now"]
print(f"{now['activePowerKw']} kW at {now['windSpeed']} m/s")

# Measured power curve (binned by wind speed)
curve = requests.get("${origin}/api/history/power-curve").json()
bins = pd.DataFrame(curve["empirical"])

# Full 10-minute SCADA history from the open dataset (CC-BY-4.0)
scada = pd.read_parquet("ace-wind-2026-10m-latest.parquet")
print(scada.describe())`,
    },
  ];
};

export default function CodeSamples({ origin }) {
  const list = samples(origin);
  const [active, setActive] = useState(list[0].id);
  const sample = list.find((s) => s.id === active);
  return (
    <section className="px-6 py-20 md:px-12 xl:px-36">
      <div className="mx-auto grid max-w-[1280px] gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <SectionHeading eyebrow="Quick start" title="A few lines to go live.">
          Read endpoints are open. Chat sessions are anonymous and private to whoever holds the token.
        </SectionHeading>
        <div>
          <div className="mb-3 flex gap-2" role="tablist">
            {list.map((s) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={s.id === active}
                onClick={() => setActive(s.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${s.id === active ? "bg-moss-900 text-white" : "bg-moss-50 text-moss-800 hover:bg-moss-100"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <CodeBlock key={sample.id} title={sample.title} code={sample.code} />
        </div>
      </div>
    </section>
  );
}
