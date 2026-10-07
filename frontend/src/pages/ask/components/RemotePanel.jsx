// Buttons that animate the big screen this chat belongs to (rate-limited per screen).

import { useRef, useState } from "react";
import Icon from "../../../components/ui/Icon.jsx";
import { REMOTE_ACTIONS } from "../../../content/ask.js";

export default function RemotePanel({ onRemote, screenName }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(null);

  const [climb, setClimb] = useState(0);
  const lastSent = useRef(0);

  // The climb slider scrubs the walk on the big screen; sent at most every 150 ms.
  const scrub = (v) => {
    setClimb(v);
    const t = performance.now();
    if (t - lastSent.current < 150) return;
    lastSent.current = t;
    onRemote("walk_to", v);
  };

  const run = async (action) => {
    setBusy(action);
    const res = await onRemote(action);
    setBusy(null);
    navigator.vibrate?.(res.ok ? [10, 40, 10] : 30);
    setNote(res.ok ? "Look up at the big screen! 👀" : res.reason || "The screen didn't respond.");
    setTimeout(() => setNote(null), 4000);
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-2xl bg-moss-900 px-4 py-2.5 text-sm font-medium text-white transition active:scale-[0.99]"
      >
        <span className="flex items-center gap-2">
          <Icon name="handPointer" className="size-4" />
          Control the {screenName} screen
        </span>
        <Icon name="arrowRight" className={`size-4 transition-transform duration-300 ${open ? "rotate-90" : ""}`} />
      </button>
      <div className={`grid transition-[grid-template-rows,opacity] duration-400 ease-[var(--ease-out-expo)] ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="grid grid-cols-3 gap-2 pt-2">
            {REMOTE_ACTIONS.map((a) => (
              <button
                key={a.action}
                type="button"
                onClick={() => run(a.action)}
                disabled={Boolean(busy)}
                className="flex flex-col items-center gap-1 rounded-2xl bg-white px-2 py-3 text-xs font-medium text-moss-800 ring-1 ring-moss-100 transition hover:bg-moss-50 active:scale-95 disabled:opacity-60"
              >
                <Icon name={a.icon} className={`size-5 text-moss-600 ${busy === a.action ? "animate-spin" : ""}`} />
                {a.label}
              </button>
            ))}
          </div>
          <div className="mt-2 rounded-2xl bg-white p-3 ring-1 ring-moss-100">
            <label className="flex items-center justify-between text-xs font-medium text-moss-800" htmlFor="climb">
              <span>Climb the tower</span>
              <span className="tabular-nums text-moss-600">{Math.round(climb * 92)} m up</span>
            </label>
            <input
              id="climb"
              type="range"
              min="0"
              max="1"
              step="0.005"
              value={climb}
              onChange={(e) => scrub(Number(e.target.value))}
              onPointerUp={() => onRemote("walk_to", climb)}
              className="mt-2 w-full accent-[var(--color-moss-600)]"
            />
            <button type="button" onClick={() => { setClimb(0); run("walk_stop"); }} className="mt-1 text-xs font-medium text-moss-600 underline underline-offset-2">
              Climb back down
            </button>
          </div>
        </div>
      </div>
      {note && <p className="mt-2 text-center text-sm font-medium text-moss-700" role="status">{note}</p>}
    </div>
  );
}
