// Plays scripted weather (content/scenarios.js) to every screen, one update a second.

import { useEffect, useRef, useState } from "react";
import Panel from "./Panel.jsx";
import Icon from "../../../components/ui/Icon.jsx";
import { SCENARIOS, sampleScenario, scenarioLength } from "../../../content/scenarios.js";
import { buildSimulation } from "../simulation.js";

export default function ScenarioPlayer({ call, admin, onRunningChange }) {
  const [running, setRunning] = useState(null); // scenario id
  const [t, setT] = useState(0);
  const [loop, setLoop] = useState(false);
  const timer = useRef(null);
  const loopRef = useRef(loop);
  loopRef.current = loop;

  const stop = () => {
    clearInterval(timer.current);
    timer.current = null;
    setRunning(null);
    onRunningChange?.(false);
  };

  const play = (scenario) => {
    clearInterval(timer.current);
    setRunning(scenario.id);
    onRunningChange?.(true);
    const started = performance.now();
    const length = scenarioLength(scenario);
    let warning = 0;
    const tick = () => {
      let elapsed = (performance.now() - started) / 1000;
      if (elapsed > length) {
        if (!loopRef.current) return stop();
        elapsed %= length;
      }
      setT(elapsed);
      const s = sampleScenario(scenario, elapsed);
      if (s.status.warning_message_flag != null) warning = s.status.warning_message_flag;
      call((tok) => admin.simulate(tok, buildSimulation({ wind: s.wind, deg: s.deg, flags: { warning: Boolean(warning) } })));
    };
    tick();
    timer.current = setInterval(tick, 1000);
  };

  useEffect(() => () => clearInterval(timer.current), []);

  return (
    <Panel
      title="Weather scenarios"
      icon={<Icon name="cloud" className="size-5 text-moss-500" />}
      action={
        <label className="flex items-center gap-2 text-sm text-moss-800">
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} className="accent-moss-600" />
          Loop
        </label>
      }
    >
      <ul className="space-y-2">
        {SCENARIOS.map((s) => {
          const active = running === s.id;
          const length = scenarioLength(s);
          return (
            <li key={s.id} className={`overflow-hidden rounded-2xl ring-1 transition ${active ? "bg-moss-900 text-white ring-moss-900" : "bg-moss-25 ring-moss-100"}`}>
              <div className="flex items-center gap-3 p-3">
                <button
                  type="button"
                  onClick={() => (active ? stop() : play(s))}
                  aria-label={active ? `Stop ${s.name}` : `Play ${s.name}`}
                  className={`flex size-10 shrink-0 items-center justify-center rounded-full transition active:scale-90 ${active ? "bg-white text-moss-900" : "bg-moss-900 text-white"}`}
                >
                  {active ? <span className="size-3 rounded-sm bg-moss-900" /> : <Icon name="play" className="size-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{s.name} <span className={`font-mono text-xs ${active ? "text-white/60" : "text-moss-600"}`}>{length}s</span></p>
                  <p className={`text-xs ${active ? "text-white/70" : "text-moss-900/60"}`}>{s.about}</p>
                </div>
                {active && (
                  <span className="font-mono text-xs text-moss-200 tabular-nums">
                    {sampleScenario(s, t).wind.toFixed(1)} m/s
                  </span>
                )}
              </div>
              {active && <div className="h-1 bg-moss-300 transition-[width] duration-1000 ease-linear" style={{ width: `${(t / length) * 100}%` }} />}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
