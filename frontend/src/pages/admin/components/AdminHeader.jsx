import { Link } from "react-router";
import TurbineMark from "../../../components/brand/TurbineMark.jsx";
import { useLive } from "../../../store/useLiveStore.js";
import { useLiveStore } from "../../../store/useLiveStore.js";

export default function AdminHeader({ onResumeLive }) {
  const { mode, connected } = useLive();
  const socket = useLiveStore((s) => s.socketStatus);
  const demo = mode === "simulate";
  return (
    <header className="sticky top-0 z-30 border-b border-moss-100 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-4 px-5 py-3">
        <Link to="/" className="flex items-center gap-2.5">
          <TurbineMark className="size-9" />
          <span className="font-display text-lg font-bold text-moss-950">
            Weston Wind <span className="font-medium text-moss-500">Admin</span>
          </span>
        </Link>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${
            demo ? "bg-moss-900 text-white" : connected ? "bg-moss-100 text-moss-800" : "bg-moss-50 text-moss-700 ring-1 ring-moss-200"
          }`}
        >
          {demo ? "SIMULATING — screens show demo data" : connected ? "LIVE — real turbine data" : "LIVE — last known (ACE API unreachable)"}
        </span>
        <span className="text-xs text-moss-900/60">socket: {socket}</span>
        <div className="ml-auto flex items-center gap-2">
          {demo && (
            <button type="button" onClick={onResumeLive} className="rounded-xl bg-gradient-to-b from-moss-700 to-moss-900 px-4 py-2 text-sm font-medium text-white transition hover:from-moss-600 active:scale-95">
              Resume live data
            </button>
          )}
          {["students", "community", "college"].map((s) => (
            <a key={s} href={`/screen/${s}`} target="_blank" rel="noreferrer" className="rounded-xl px-3 py-2 text-sm text-moss-800 capitalize ring-1 ring-moss-200 hover:bg-moss-50">
              {s} ↗
            </a>
          ))}
        </div>
      </div>
    </header>
  );
}
