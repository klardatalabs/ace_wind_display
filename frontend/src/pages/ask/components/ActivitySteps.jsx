// What Ace did before answering: thinking, then each tool it ran (reading the books,
// searching the web, checking live data...) as a small timeline. Steps stream in as they
// start and finish; tools from the same round ran in parallel and share a rail segment.
// Once the answer is done the timeline folds into a one-line summary that can be reopened.

import { useState } from "react";
import Icon from "../../../components/ui/Icon.jsx";

const KIND = {
  live_status: { icon: "gauge", label: "Checking the turbine's live data" },
  history: { icon: "clock", label: "Looking through the turbine's history" },
  knowledge_search: { icon: "book", label: "Reading the books" },
  web_search: { icon: "globe", label: "Searching the web" },
  photo_search: { icon: "image", label: "Finding pictures" },
  screen_action: { icon: "eye", label: "Moving the big screen" },
};

const seconds = (ms) => (ms < 1000 ? `${Math.max(ms, 1)} ms` : `${(ms / 1000).toFixed(1)} s`);

export default function ActivitySteps({ steps = [], thinking, streaming }) {
  const [open, setOpen] = useState(null); // null: follow streaming (open while working)
  if (!steps.length && !thinking) return null;

  const expanded = open ?? streaming;
  const running = steps.some((s) => s.status === "running");
  const total = steps.reduce((sum, s) => sum + (s.ms || 0), 0);
  const failed = steps.filter((s) => s.status === "failed").length;
  const rounds = [...new Set(steps.map((s) => s.round ?? 1))];

  const summary = streaming
    ? running
      ? "Working…"
      : "Thinking…"
    : `Used ${steps.length} ${steps.length === 1 ? "tool" : "tools"}${total ? ` · ${seconds(total)}` : ""}${failed ? ` · ${failed} failed` : ""}`;

  return (
    <div className="mb-2 rounded-2xl bg-white/70 text-moss-800 ring-1 ring-moss-100 backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen(!expanded)}
        disabled={!steps.length}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium"
      >
        <span className={`grid size-5 place-items-center rounded-full bg-moss-100 text-moss-700 ${streaming ? "animate-pulse" : ""}`}>
          <Icon name="brain" className="size-3.5" />
        </span>
        <span className={streaming ? "shimmer-text" : ""}>{summary}</span>
        {steps.length > 0 && <Icon name="chevron" className={`ml-auto size-4 text-moss-500 transition-transform ${expanded ? "rotate-180" : ""}`} />}
      </button>

      {expanded && steps.length > 0 && (
        <ol className="relative space-y-1 px-3 pb-2.5">
          {rounds.map((round, r) => (
            <li key={round}>
              {rounds.length > 1 && <p className="mt-1 mb-0.5 pl-7 text-[10px] font-semibold tracking-wide text-moss-500 uppercase">{r === 0 ? "First look" : "Then"}</p>}
              <ul className="relative space-y-1.5 border-l border-dashed border-moss-200 pl-4 ml-2.5">
                {steps.filter((s) => (s.round ?? 1) === round).map((s) => (
                  <Step key={s.id} step={s} />
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Step({ step }) {
  const kind = KIND[step.kind] ?? { icon: "cogs", label: step.label || "Working" };
  const state = step.status ?? "done";
  return (
    <li className="relative flex items-start gap-2 text-xs">
      <span
        className={`absolute -left-[25px] top-0.5 grid size-[18px] place-items-center rounded-full ring-2 ring-white ${
          state === "running" ? "bg-moss-100 text-moss-700" : state === "failed" ? "bg-amber-100 text-amber-700" : "bg-moss-600 text-white"
        }`}
      >
        <Icon name={kind.icon} className={`size-3 ${state === "running" ? "animate-pulse" : ""}`} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-moss-900">
          {step.label || kind.label}
          {state === "failed" && <Icon name="warning" className="size-3.5 text-amber-600" title="This step failed" />}
        </p>
        {step.detail && <p className="truncate text-[11px] text-moss-600">“{step.detail}”</p>}
      </div>
      <span className="shrink-0 pt-px text-[10px] text-moss-500 tabular-nums">
        {state === "running" ? <span className="inline-block size-1.5 animate-ping rounded-full bg-moss-500" /> : step.ms ? seconds(step.ms) : <Icon name="check" className="size-3" />}
      </span>
    </li>
  );
}
