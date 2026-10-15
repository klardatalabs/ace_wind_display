// Every endpoint, grouped, with a live "Try it" that calls this server and shows the JSON.

import { useState } from "react";
import SectionHeading from "../../../components/ui/SectionHeading.jsx";
import Icon from "../../../components/ui/Icon.jsx";
import { ENDPOINTS } from "../../../lib/api.js";

const METHOD_STYLE = {
  GET: "bg-moss-100 text-moss-800",
  POST: "bg-moss-800 text-white",
  DELETE: "bg-moss-950 text-white",
  WS: "bg-moss-400 text-white",
};

function Row({ e }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    const t0 = performance.now();
    try {
      const res = await fetch(e.path);
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        // not JSON
      }
      setResult({ status: res.status, ms: Math.round(performance.now() - t0), body: pretty.slice(0, 4000) });
    } catch (err) {
      setResult({ status: "ERR", body: err.message });
    } finally {
      setLoading(false);
    }
  };
  return (
    <li className="rounded-2xl bg-white p-4 ring-1 ring-moss-100 transition hover:ring-moss-200">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`w-16 rounded-lg py-1 text-center font-mono text-xs font-semibold ${METHOD_STYLE[e.method]}`}>{e.method}</span>
        <code className="font-mono text-sm break-all text-moss-950">{e.path}</code>
        {e.tryIt && (
          <button type="button" onClick={run} disabled={loading} className="ml-auto flex items-center gap-1.5 rounded-full bg-moss-50 px-3 py-1 text-xs font-medium text-moss-800 ring-1 ring-moss-100 hover:bg-moss-100 disabled:opacity-60">
            <Icon name="play" className={`size-3.5 ${loading ? "animate-pulse" : ""}`} />
            Try it
          </button>
        )}
      </div>
      <p className="mt-2 text-sm text-moss-900/70">{e.about}</p>
      {result && (
        <div className="mt-3">
          <p className="mb-1 font-mono text-xs text-moss-600">
            HTTP {result.status} {result.ms != null && `· ${result.ms} ms`}
          </p>
          <pre className="max-h-72 overflow-auto rounded-xl bg-moss-950 p-3 font-mono text-[12px] leading-relaxed text-moss-50">{result.body}</pre>
        </div>
      )}
    </li>
  );
}

export default function EndpointExplorer() {
  const groups = [...new Set(ENDPOINTS.map((e) => e.group))];
  return (
    <section id="endpoints" className="scroll-mt-28 bg-moss-25 px-6 py-20 md:px-12 xl:px-36">
      <div className="mx-auto max-w-[1280px]">
        <SectionHeading eyebrow="REST + WebSocket + SSE" title="Every endpoint, live.">
          These are the same endpoints the hoardings and phones use. Hit “Try it” to call this server right now.
        </SectionHeading>
        <div className="mt-12 grid gap-10 lg:grid-cols-2">
          {groups.map((g) => (
            <div key={g}>
              <h3 className="mb-3 font-display text-xl font-semibold text-moss-950">{g}</h3>
              <ul className="space-y-3">
                {ENDPOINTS.filter((e) => e.group === g).map((e) => (
                  <Row key={e.method + e.path} e={e} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
