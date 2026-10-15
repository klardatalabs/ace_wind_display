// The open datasets: the list from GET /api/datasets (with the dates each one covers) and an
// instant CSV download for the dates you pick, straight from GET /api/datasets/{id}.csv. No
// sign-up and no email. The complete archive stays on Zenodo as Parquet.

import { useEffect, useMemo, useState } from "react";
import SectionHeading from "../../../components/ui/SectionHeading.jsx";
import CodeBlock from "../../../components/ui/CodeBlock.jsx";
import Icon from "../../../components/ui/Icon.jsx";
import { api } from "../../../lib/api.js";
import { usePublicOrigin } from "../../../hooks/usePublicOrigin.js";
import { ATTRIBUTION_TEXT, LICENSE_URL } from "../../../lib/impact.js";

const field = "w-full rounded-xl bg-white px-3.5 py-2.5 text-moss-950 ring-1 ring-moss-200 outline-none focus:ring-2 focus:ring-moss-400";
const DAY_MS = 86_400_000;
const addDays = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** A sensible default range for a dataset: its last week (or less), inside what it covers. */
function defaultRange(d) {
  const to = d.coverage?.to ?? new Date().toISOString().slice(0, 10);
  const from = addDays(to, -Math.min(6, d.maxRangeDays - 1));
  return { from: d.coverage?.from && from < d.coverage.from ? d.coverage.from : from, to };
}

export default function DatasetsSection() {
  const origin = usePublicOrigin();
  const [list, setList] = useState(null);
  const [error, setError] = useState(false);
  const [pick, setPick] = useState({ id: "", from: "", to: "" });

  useEffect(() => {
    api
      .datasets()
      .then((res) => {
        setList(res);
        const first = res.datasets[0];
        if (first) setPick({ id: first.id, ...defaultRange(first) });
      })
      .catch(() => setError(true));
  }, []);

  const dataset = list?.datasets.find((d) => d.id === pick.id);
  const choose = (id) => {
    const d = list.datasets.find((x) => x.id === id);
    setPick({ id, ...defaultRange(d) });
  };
  const days = pick.from && pick.to ? Math.round((Date.parse(pick.to) - Date.parse(pick.from)) / DAY_MS) + 1 : 0;
  const problem = !dataset ? null : pick.to < pick.from ? "The end date is before the start date." : days > dataset.maxRangeDays ? `${dataset.label} downloads ${dataset.maxRangeDays} days at a time.` : null;
  const path = dataset ? `/api/datasets/${dataset.id}.csv?from=${pick.from}&to=${pick.to}` : "";
  const curl = useMemo(() => `curl -L -o ${dataset?.id ?? "data"}.csv "${origin}${path}"`, [origin, path, dataset]);

  return (
    <section id="data" className="scroll-mt-28 px-6 py-20 md:px-12 xl:px-36">
      <div className="mx-auto max-w-[1280px]">
        <SectionHeading eyebrow="Open data · CC BY 4.0" title="Download the data, instantly.">
          Pick a dataset and the dates you want: the CSV streams straight from the turbine's database. No sign-up, no email. The full archive is on Zenodo as Parquet.
        </SectionHeading>

        <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <ul className="min-w-0 space-y-3">
            {error && <li className="rounded-2xl bg-white p-4 text-sm text-moss-800 ring-1 ring-moss-200">The dataset list isn't available right now. Please try again shortly.</li>}
            {!list && !error && <li className="h-24 animate-pulse rounded-2xl bg-moss-50" />}
            {list?.datasets.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  onClick={() => choose(d.id)}
                  className={`flex w-full items-start gap-4 rounded-2xl p-4 text-left ring-1 transition ${d.id === pick.id ? "bg-moss-50 ring-moss-400" : "bg-white ring-moss-100 hover:ring-moss-300"}`}
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-moss-50 text-moss-600">
                    <Icon name="database" className="size-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-moss-950">{d.label}</span>
                    <span className="block text-sm text-moss-900/70">{d.description}</span>
                    <span className="mt-1 block font-mono text-xs text-moss-700">
                      {d.coverage ? `${d.coverage.from} → ${d.coverage.to}` : "dates unavailable"} · up to {d.maxRangeDays} days per download
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {list && (
              <li className="rounded-2xl bg-moss-25 p-4 text-xs leading-relaxed text-moss-900/70 ring-1 ring-moss-100">
                Please credit: {ATTRIBUTION_TEXT}{" "}
                <a href={LICENSE_URL} className="underline" target="_blank" rel="noreferrer">
                  CC BY 4.0
                </a>
                {list.archiveUrl && (
                  <>
                    {" · "}
                    <a href={list.archiveUrl} className="underline" target="_blank" rel="noreferrer">
                      Full archive on Zenodo
                    </a>
                  </>
                )}
              </li>
            )}
          </ul>

          {dataset && (
            <div className="min-w-0 space-y-4 self-start rounded-3xl bg-moss-25 p-6 ring-1 ring-moss-100 lg:sticky lg:top-28">
              <h3 className="font-display text-xl font-semibold text-moss-950">{dataset.label}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-moss-800">
                  From
                  <input className={`${field} mt-1`} type="date" value={pick.from} min={dataset.coverage?.from} max={pick.to} onChange={(e) => setPick((p) => ({ ...p, from: e.target.value }))} />
                </label>
                <label className="text-sm text-moss-800">
                  To
                  <input className={`${field} mt-1`} type="date" value={pick.to} min={pick.from} max={dataset.coverage?.to} onChange={(e) => setPick((p) => ({ ...p, to: e.target.value }))} />
                </label>
              </div>
              <p className="text-xs text-moss-900/60">UK dates, inclusive. Times in the file are UTC.</p>
              {problem ? (
                <p className="rounded-xl bg-white p-3 text-sm text-moss-800 ring-1 ring-moss-200" role="alert">
                  {problem}
                </p>
              ) : (
                <a href={path} download className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-moss-800 to-moss-950 py-3 font-medium text-white transition hover:from-moss-700 active:scale-[0.99]">
                  <Icon name="download" className="size-5" />
                  Download CSV · {days} {days === 1 ? "day" : "days"}
                </a>
              )}
              <CodeBlock title="Or from a terminal" code={curl} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
