import { useEffect, useState } from "react";
import { api } from "../../../lib/api.js";

const CHANGE_MS = 12_000;
const REFRESH_MS = 5 * 60_000;

export default function CommunityNews() {
  const [news, setNews] = useState({ items: [], stale: true });
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () => api.news().then((result) => {
      if (active) setNews(result);
    }).catch(() => {
      if (active) setNews((previous) => ({ ...previous, stale: true }));
    });
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => { active = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (news.items.length < 2) return undefined;
    const timer = setInterval(() => setIndex((current) => (current + 1) % news.items.length), CHANGE_MS);
    return () => clearInterval(timer);
  }, [news.items.length]);

  const item = news.items[index % news.items.length];

  return (
    <aside data-keepout aria-label="Clean energy news" className="pointer-events-none absolute top-[9vmin] right-[2.2vmin] z-20 flex h-[clamp(132px,20vmin,185px)] w-[clamp(240px,21vw,340px)] flex-col overflow-hidden rounded-2xl border border-white/30 bg-moss-950/95 p-3.5 text-white shadow-2xl portrait:top-[170px] portrait:right-[4vmin] portrait:w-[min(82vw,340px)]">
      <div className="flex items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-moss-200">
        <span>Clean energy news</span>
        {item && <span className="tabular-nums text-white/60">{index % news.items.length + 1}/{news.items.length}</span>}
      </div>
      {item ? (
        <>
          <p key={item.url} className="mt-2 line-clamp-3 font-display text-[clamp(15px,1.65vmin,22px)] leading-snug font-semibold">{item.title}</p>
          <p className="mt-auto truncate pt-2 text-[11px] text-white/70">
            {item.publisher} · {new Date(item.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}{news.stale ? " · last update" : ""}
          </p>
        </>
      ) : <p className="mt-3 text-sm leading-snug text-white/75">Waiting for recent clean-energy stories.</p>}
    </aside>
  );
}
