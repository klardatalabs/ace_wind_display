import { useEffect, useState } from "react";
import { Link } from "react-router";
import TurbineMark from "../../components/brand/TurbineMark.jsx";
import { api } from "../../lib/api.js";

export default function SeasonsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api.seasons(controller.signal).then(setData).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, []);

  return (
    <main className="min-h-dvh bg-moss-950 px-5 py-6 text-white sm:px-10 sm:py-9 xl:px-16">
      <header className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3"><TurbineMark className="size-12" /><span className="font-display text-xl font-semibold">Lawrence Weston wind</span></div>
        <nav className="flex gap-3 text-sm" aria-label="Seasons navigation">
          <Link className="rounded-full border border-white/30 px-4 py-2 hover:bg-white/10" to="/screen/college">College screen</Link>
          <Link className="rounded-full border border-white/30 px-4 py-2 hover:bg-white/10" to="/">Home</Link>
        </nav>
      </header>
      <div className="mx-auto max-w-[1600px] pt-10 sm:pt-14">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-moss-300">College research</p>
        <h1 className="mt-3 font-display text-4xl leading-tight sm:text-6xl">Wind through the seasons</h1>
        <p className="mt-5 max-w-3xl text-white/70">ACE turbine measurements over the latest complete four-season year. Each card shows mean wind speed, the most frequent nacelle heading, and how much of the expected 10-minute history is present.</p>
        {error && <p role="status" className="mt-8 rounded-2xl border border-white/20 p-5">Seasonal history is temporarily unavailable.</p>}
        {!data && !error && <p role="status" className="mt-8 text-white/70">Loading seasonal history…</p>}
        {data && <>
          <p className="mt-6 text-sm text-white/60">{data.year} comparison · {data.source} · Direction: {data.directionMethod}</p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.seasons.map((season) => {
              const most = Math.max(1, ...season.directions.map((direction) => direction.samples));
              return <section key={season.name} className="rounded-3xl border border-white/15 bg-white/5 p-6">
                <h2 className="font-display text-3xl">{season.name}</h2>
                <p className="mt-1 text-xs text-white/55">{new Date(season.from).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" })} – {new Date(Date.parse(season.to) - 86400_000).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" })}</p>
                <p className="mt-7 text-4xl font-semibold tabular-nums">{season.meanSpeedMs == null ? "—" : `${season.meanSpeedMs} m/s`}</p>
                <p className="mt-1 text-sm text-white/60">Mean measured wind speed</p>
                <p className="mt-6 text-sm">Most frequent heading: <strong>{season.dominantDirection ?? "No data"}</strong></p>
                <div className="mt-4 grid grid-cols-8 gap-1" aria-label={`Nacelle heading distribution for ${season.name}`}>
                  {season.directions.map((direction) => <div key={direction.name} className="text-center text-[10px] text-white/65">
                    <div className="flex h-14 items-end justify-center"><div className="w-3 rounded-t bg-moss-300" style={{ height: `${direction.samples ? Math.max(3, direction.samples / most * 100) : 0}%` }} /></div>
                    {direction.name}
                  </div>)}
                </div>
                <p className="mt-5 text-xs text-white/60">{season.samples.toLocaleString("en-GB")} of {season.expectedSamples.toLocaleString("en-GB")} expected wind-speed samples · {season.coveragePct}% coverage</p>
              </section>;
            })}
          </div>
          <p className="mt-8 max-w-4xl text-sm leading-relaxed text-white/60">Nacelle heading is where the turbine faces, so it approximates wind direction. Gaps can affect both the mean and the direction pattern. The cards include all stored readings in each season; they do not fill missing intervals.</p>
        </>}
      </div>
    </main>
  );
}
