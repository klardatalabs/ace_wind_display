import { XMLParser } from "fast-xml-parser";

const MAX_BYTES = 2_000_000;
const AGE_MS = 90 * 86400_000;
const XML = new XMLParser({ ignoreAttributes: true, trimValues: true });
const SOURCES = [
  { name: "U.S. Energy Information Administration", host: "eia.gov", url: "https://www.eia.gov/rss/todayinenergy.xml", encoding: "iso-8859-1" },
  { name: "U.S. Department of Energy", host: "energy.gov", url: "https://www.energy.gov/rss/energygov/2193718", encoding: "utf-8" },
];
const TOPIC = /\b(wind|turbines?|offshore|renewables?|solar|clean energy|green energy|low.carbon|carbon.free|battery storage|energy storage|geothermal|tidal|wave energy)\b/i;
const AI_ENERGY = /\b(?:AI|artificial intelligence|data cent(?:re|er)s?)\b/i;
const CLEAN_POWER = /\b(?:renewables?|clean|low.carbon|carbon.free|wind|solar|nuclear)\b/i;

export function parseFeed(xml, source) {
  const channel = XML.parse(xml)?.rss?.channel;
  if (!channel) throw new Error(`Invalid RSS feed from ${source.name}`);
  return (Array.isArray(channel.item) ? channel.item : channel.item ? [channel.item] : []).map((item) => ({
    title: String(item.title ?? "").trim().slice(0, 240),
    description: String(item.description ?? "").replace(/<[^>]*>/g, " ").slice(0, 600),
    url: String(item.link ?? "").trim(),
    publishedAt: Number.isFinite(Date.parse(item.pubDate ?? "")) ? new Date(item.pubDate).toISOString() : null,
    publisher: source.name,
    host: source.host,
  }));
}

export function selectNews(items, now = new Date()) {
  const seen = new Set();
  return items.filter((item) => {
    let url;
    try { url = new URL(item.url); } catch { return false; }
    const date = new Date(item.publishedAt);
    const text = `${item.title} ${item.description}`;
    if (!item.title || url.protocol !== "https:" || !(url.hostname === item.host || url.hostname.endsWith(`.${item.host}`))) return false;
    if (!Number.isFinite(+date) || +date > +now + 86400_000 || +now - +date > AGE_MS) return false;
    if (!TOPIC.test(text) && !(AI_ENERGY.test(text) && CLEAN_POWER.test(text))) return false;
    if (seen.has(url.href)) return false;
    seen.add(url.href);
    return true;
  }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, 8)
    .map(({ title, description, url, publishedAt, publisher }) => ({
      title, summary: description.replace(/\s+/g, " ").trim().slice(0, 240), url, publishedAt, publisher,
    }));
}

async function readFeed(source) {
  const response = await fetch(source.url, { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "WestonWindNews/1.0" } });
  if (!response.ok) throw new Error(`${source.name} returned ${response.status}`);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error(`${source.name} feed too large`);
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return parseFeed(new TextDecoder(source.encoding).decode(bytes), source);
}

export async function fetchLatestNews() {
  const results = await Promise.allSettled(SOURCES.map(readFeed));
  const feeds = results.filter((result) => result.status === "fulfilled");
  if (!feeds.length) throw new Error("Every news feed failed");
  return selectNews(feeds.flatMap((result) => result.value));
}
