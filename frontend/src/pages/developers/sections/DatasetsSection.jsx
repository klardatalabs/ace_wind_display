// The open SCADA datasets: list from /api/datasets/list and a request form that emails
// (or shows) a signed, time-limited download link via /api/datasets/request.

import { useEffect, useState } from "react";
import SectionHeading from "../../../components/ui/SectionHeading.jsx";
import Icon from "../../../components/ui/Icon.jsx";
import { api } from "../../../lib/api.js";
import { ATTRIBUTION_TEXT, LICENSE_URL } from "../../../lib/impact.js";

const field = "w-full rounded-xl bg-white px-3.5 py-2.5 text-moss-950 ring-1 ring-moss-200 outline-none focus:ring-2 focus:ring-moss-400";

export default function DatasetsSection() {
  const [datasets, setDatasets] = useState({});
  const [form, setForm] = useState({ name: "", email: "", organization: "", purpose: "", datasetType: "10m_scada" });
  const [state, setState] = useState({ status: "idle" });

  useEffect(() => {
    api.datasets().then(setDatasets).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setState({ status: "sending" });
    try {
      const res = await api.requestDataset(form);
      setState({ status: "done", res });
    } catch (err) {
      setState({ status: "error", error: err.message });
    }
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <section id="data" className="scroll-mt-28 px-6 py-20 md:px-12 xl:px-36">
      <div className="mx-auto max-w-[1280px]">
        <SectionHeading eyebrow="Open data · CC-BY-4.0" title="The whole history, as Parquet.">
          Every 10-minute SCADA interval since commissioning, daily aggregates and the status event log.
        </SectionHeading>
        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <ul className="space-y-3">
            {Object.entries(datasets).map(([id, d]) => (
              <li key={id} className="flex items-start gap-4 rounded-2xl bg-white p-4 ring-1 ring-moss-100">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-moss-50 text-moss-600">
                  <Icon name="database" className="size-6" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-moss-950">{d.label}</p>
                  <p className="font-mono text-xs text-moss-700">
                    {d.filename} · {d.format} · {d.approxSize}
                  </p>
                </div>
              </li>
            ))}
            <li className="rounded-2xl bg-moss-25 p-4 text-xs leading-relaxed text-moss-900/70 ring-1 ring-moss-100">
              Please credit: {ATTRIBUTION_TEXT}{" "}
              <a href={LICENSE_URL} className="underline" target="_blank" rel="noreferrer">
                CC-BY-4.0
              </a>
            </li>
          </ul>

          <form onSubmit={submit} className="space-y-3 rounded-3xl bg-moss-25 p-6 ring-1 ring-moss-100">
            <h3 className="font-display text-xl font-semibold text-moss-950">Request a download link</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <input className={field} placeholder="Name" value={form.name} onChange={set("name")} autoComplete="name" />
              <input className={field} placeholder="Email *" type="email" required value={form.email} onChange={set("email")} autoComplete="email" />
            </div>
            <input className={field} placeholder="Organisation" value={form.organization} onChange={set("organization")} />
            <select className={field} value={form.datasetType} onChange={set("datasetType")}>
              {Object.entries(datasets).map(([id, d]) => (
                <option key={id} value={id}>
                  {d.label}
                </option>
              ))}
            </select>
            <textarea className={field} rows={3} placeholder="What will you use it for?" value={form.purpose} onChange={set("purpose")} />
            <button type="submit" disabled={state.status === "sending"} className="w-full rounded-xl bg-gradient-to-b from-moss-800 to-moss-950 py-3 font-medium text-white transition hover:from-moss-700 active:scale-[0.99] disabled:opacity-60">
              {state.status === "sending" ? "Requesting…" : "Get the link"}
            </button>
            {state.status === "done" && (
              <p className="rounded-xl bg-white p-3 text-sm text-moss-800 ring-1 ring-moss-100" role="status">
                {state.res?.emailSent ? "Check your inbox — the link is valid for a limited time." : state.res?.downloadUrl ? (
                  <>
                    Your link:{" "}
                    <a className="break-all underline" href={state.res.downloadUrl}>
                      download
                    </a>
                  </>
                ) : (
                  "Request received."
                )}
              </p>
            )}
            {state.status === "error" && <p className="text-sm text-moss-800" role="alert">{state.error}</p>}
          </form>
        </div>
      </div>
    </section>
  );
}
