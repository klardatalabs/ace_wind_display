import { useEffect, useState } from "react";
import { Link } from "react-router";
import { api } from "../../lib/api.js";
import TurbineMark from "../../components/brand/TurbineMark.jsx";

export default function NewsPage() {
  const [news, setNews] = useState({ items: [], updatedAt: null, stale: true });

  useEffect(() => {
    const controller = new AbortController();
    const load = () => api.news(controller.signal).then(setNews).catch(() => { if (!controller.signal.aborted) setNews((old) => ({ ...old, stale: true })); });
    load();
    const timer = setInterval(load, 5 * 60_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);

  return (
    <main className="min-h-dvh bg-moss-950 px-5 py-6 text-white sm:px-10 sm:py-9 xl:px-16">
      <header className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3"><TurbineMark className="size-12" /><span className="font-display text-xl font-semibold">Weston Wind</span></div>
        <nav className="flex gap-3 text-sm" aria-label="News navigation">
          <Link className="rounded-full border border-white/30 px-4 py-2 hover:bg-white/10" to="/screen/college">College screen</Link>
          <Link className="rounded-full border border-white/30 px-4 py-2 hover:bg-white/10" to="/">Home</Link>
        </nav>
      </header>

      <div className="mx-auto max-w-[1600px] pt-10 sm:pt-14">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-moss-300">The future is calling</p>
        <h1 className="mt-3 max-w-4xl font-display text-4xl leading-tight sm:text-6xl">What's happening in clean energy</h1>
        <p className="mt-5 max-w-3xl text-base text-white/70 sm:text-lg">Recent wind and clean-energy stories selected from public publisher feeds. Open a story to read it at the source.</p>
        <p className="mt-5 text-sm text-white/60" role="status">
          {news.updatedAt ? `${news.stale ? "Latest saved update" : "Updated"} ${new Date(news.updatedAt).toLocaleString("en-GB")}` : "Waiting for the first news update"}
        </p>

        {news.items.length ? (
          <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {news.items.map((item) => (
              <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer" className="group flex min-h-48 flex-col justify-between rounded-3xl border border-white/15 bg-white/5 p-6 transition hover:border-moss-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-moss-300">
                <h2 className="font-display text-xl leading-snug font-semibold group-hover:text-moss-200">{item.title}</h2>
                {item.summary && <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-white/70">{item.summary}</p>}
                <p className="mt-8 text-sm text-white/60">{item.publisher} · {new Date(item.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
              </a>
            ))}
          </div>
        ) : <p className="mt-10 rounded-3xl border border-white/15 bg-white/5 p-7 text-white/70">No recent matching stories are available yet. Check back soon.</p>}
      </div>
    </main>
  );
}
