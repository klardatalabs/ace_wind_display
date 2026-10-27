import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../../../lib/api.js";

const FEATURE_MS = 10_000;
const REFRESH_MS = 60_000;
const HOLD_MS = 25_000;
const dateOf = (item) => new Date(item.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const illustration = (item) => /heat|district/i.test(item.title) ? "heat" : /solar|photovoltaic/i.test(item.title) ? "solar" : /wind|turbine|offshore/i.test(item.title) ? "wind" : "site";

export default function CommunityNews({ onSelect }) {
  const [news, setNews] = useState({ items: [], stale: true });
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () => api.news().then((result) => {
      if (active) { setNews(result); setLoading(false); }
    }).catch(() => {
      if (active) { setNews((previous) => ({ ...previous, stale: true })); setLoading(false); }
    });
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const stories = news.items.slice(0, 3);
  useEffect(() => {
    if (held || stories.length < 2) return undefined;
    const timer = setInterval(() => setIndex((current) => (current + 1) % stories.length), FEATURE_MS);
    return () => clearInterval(timer);
  }, [held, stories.length]);

  useEffect(() => {
    if (!held) return undefined;
    const timer = setTimeout(() => setHeld(false), HOLD_MS);
    return () => clearTimeout(timer);
  }, [held, index]);

  const choose = (next) => {
    setIndex(next);
    setHeld(true);
    onSelect();
  };
  const featured = stories[index % stories.length];
  const previews = stories.map((item, i) => ({ item, i })).filter(({ i }) => i !== index % stories.length);

  return <aside data-keepout className="news-chapter absolute z-20 text-white" aria-label="Clean energy news">
    <div className="news-heading">
      <div><p className="news-kicker">Lawrence Weston wind / clean energy</p><h2>News</h2></div>
      <p>Original publisher headlines · illustrative images</p>
    </div>
    {featured ? <div className="news-layout">
      <article key={featured.url} className="news-feature">
        <div className={`news-feature-photo news-photo-${illustration(featured)}`} aria-hidden="true" />
        <div className="news-feature-copy">
          <p className="news-kicker">Featured story <span aria-hidden="true">/</span> {index % stories.length + 1} of {stories.length}</p>
          <h3>{featured.title}</h3>
          <p className="news-byline">{featured.publisher} <span aria-hidden="true">·</span> {dateOf(featured)}</p>
          {news.stale && <p className="news-stale">Last saved headlines · feed update pending</p>}
        </div>
        <a className="news-source" href={featured.url} target="_blank" rel="noopener noreferrer" aria-label={`Read original story at ${featured.publisher}: ${featured.title}`}>
          <QRCodeSVG value={featured.url} size={128} level="M" fgColor="#06211a" bgColor="#ffffff" className="news-qr" />
          <span>Scan to read<br />the original source <span aria-hidden="true">↗</span></span>
        </a>
        <span className="news-image-credit">Illustrative image · not from article</span>
      </article>
      <div className="news-previews" aria-label="Other recent stories">
        {previews.map(({ item, i }) => <button key={item.url} type="button" onClick={() => choose(i)} className="news-preview" aria-label={`Feature story: ${item.title}`}>
          <span className={`news-preview-photo news-photo-${illustration(item)}`} aria-hidden="true" />
          <span className="news-kicker">{String(i + 1).padStart(2, "0")} / Clean energy</span>
          <strong>{item.title}</strong>
          <span className="news-byline">{item.publisher} <span aria-hidden="true">·</span> {dateOf(item)}</span>
          <span className="news-preview-arrow" aria-hidden="true">↗</span>
        </button>)}
        {stories.length === 1 && <p className="news-single">More recent stories will appear when their publishers release them.</p>}
      </div>
    </div> : <div className="news-empty"><p className="news-kicker">{loading ? "Checking trusted publishers" : "Waiting for verified stories"}</p><h3>{loading ? "Finding the latest clean-energy stories…" : "No recent clean-energy headlines right now."}</h3><p>{loading ? "Headlines will appear here shortly." : "The screen will update automatically when a trusted publisher has a relevant story."}</p></div>}
  </aside>;
}
