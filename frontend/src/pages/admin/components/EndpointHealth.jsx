// Pings every public read endpoint and shows status + latency, so an operator can see at a
// glance which data sources the screens are actually getting.

import { useCallback, useEffect, useState } from "react";
import Panel from "./Panel.jsx";
import Icon from "../../../components/ui/Icon.jsx";
import { ENDPOINTS } from "../../../lib/api.js";
import { useLiveStore } from "../../../store/useLiveStore.js";

export default function EndpointHealth() {
  const socket = useLiveStore((s) => s.socketStatus);
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(null);

  const run = useCallback(async () => {
    const targets = ENDPOINTS.filter((e) => e.tryIt);
    setRows(targets.map((e) => ({ ...e, status: "…" })));
    await Promise.all(
      targets.map(async (e, i) => {
        const t0 = performance.now();
        let status;
        let body = "";
        try {
          const res = await fetch(e.path);
          status = res.status;
          body = (await res.text()).slice(0, 1200);
        } catch (err) {
          status = "ERR";
          body = err.message;
        }
        const ms = Math.round(performance.now() - t0);
        setRows((r) => r.map((row, j) => (j === i ? { ...row, status, ms, body } : row)));
      })
    );
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  const tone = (s) => (s === 200 ? "bg-moss-500" : s === "…" ? "bg-moss-200 animate-pulse" : "bg-moss-900");

  return (
    <Panel
      title="API endpoints"
      icon={<Icon name="database" className="size-5 text-moss-500" />}
      action={
        <button type="button" onClick={run} className="rounded-xl px-3 py-1.5 text-sm text-moss-800 ring-1 ring-moss-200 hover:bg-moss-50">
          Re-check
        </button>
      }
    >
      <ul className="divide-y divide-moss-100 text-sm">
        <li className="flex items-center gap-3 py-2">
          <span className={`size-2.5 rounded-full ${socket === "open" ? "bg-moss-500" : "bg-moss-900"}`} />
          <span className="w-14 font-mono text-xs text-moss-600">WS</span>
          <span className="flex-1 font-mono text-moss-950">/ws</span>
          <span className="font-mono text-xs text-moss-700">{socket}</span>
        </li>
        {rows.map((r) => (
          <li key={r.path} className="py-2">
            <button type="button" onClick={() => setOpen(open === r.path ? null : r.path)} className="flex w-full items-center gap-3 text-left">
              <span className={`size-2.5 shrink-0 rounded-full ${tone(r.status)}`} />
              <span className="w-14 font-mono text-xs text-moss-600">{r.method}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-moss-950">{r.path}</span>
              <span className="font-mono text-xs text-moss-700 tabular-nums">
                {r.status} {r.ms != null && `· ${r.ms} ms`}
              </span>
            </button>
            {open === r.path && (
              <pre className="mt-2 max-h-56 overflow-auto rounded-xl bg-moss-950 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-moss-100">{r.body}</pre>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
