// Which hoardings are connected, and a remote to drive any of them.

import { useEffect, useState } from "react";
import Panel from "./Panel.jsx";
import Icon from "../../../components/ui/Icon.jsx";

const SCREENS = [
  { key: "students", name: "Students", theme: "cartoon" },
  { key: "community", name: "Community", theme: "realistic + scan" },
  { key: "college", name: "College", theme: "blueprint" },
];
const ACTIONS = [
  ["look_inside", "Look inside"],
  ["tower_inside", "Tower"],
  ["close_inside", "Close"],
  ["fly_to_nacelle", "Nacelle"],
  ["fly_to_base", "Base"],
  ["overview", "Overview"],
  ["spin_blades", "Spin"],
];

export default function ScreensControl({ call, admin }) {
  const [counts, setCounts] = useState({});
  const [note, setNote] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () => call((t) => admin.screens(t)).then((c) => alive && c && setCounts(c));
    load();
    const id = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [call, admin]);

  const send = async (screen, action) => {
    const res = await call((t) => admin.command(t, screen, action));
    if (res) setNote(`${action.replace(/_/g, " ")} → ${screen}: ${res.delivered ? `${res.delivered} screen(s)` : "no screen connected"}`);
    setTimeout(() => setNote(null), 3500);
  };

  return (
    <Panel title="Hoarding screens" icon={<Icon name="qrcode" className="size-5 text-moss-500" />}>
      <div className="space-y-3">
        {SCREENS.map((s) => {
          const n = counts[s.key] ?? 0;
          return (
            <div key={s.key} className="rounded-2xl bg-moss-25 p-3 ring-1 ring-moss-100">
              <div className="flex items-center gap-2">
                <span className={`size-2.5 rounded-full ${n ? "bg-moss-500 shadow-[0_0_0_4px_rgb(70_163_116/0.2)]" : "bg-moss-200"}`} />
                <a href={`/screen/${s.key}`} target="_blank" rel="noreferrer" className="font-medium text-moss-950 hover:underline">
                  {s.name}
                </a>
                <span className="text-xs text-moss-900/55">{s.theme}</span>
                <span className="ml-auto font-mono text-xs text-moss-700">{n} connected</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ACTIONS.map(([action, label]) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => send(s.key, action)}
                    className="rounded-full bg-white px-2.5 py-1 text-xs text-moss-800 ring-1 ring-moss-200 transition hover:bg-moss-100 active:scale-95"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {note && <p className="text-sm text-moss-700" role="status">{note}</p>}
      </div>
    </Panel>
  );
}
