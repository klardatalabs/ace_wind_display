import test from "node:test";
import assert from "node:assert/strict";
import { fetchLatestNews, parseFeed, selectNews } from "./feed.js";

const source = { name: "EIA", host: "eia.gov" };
const xml = `<?xml version="1.0"?><rss><channel>
  <item><title>Wind turbines supply clean electricity to data centres</title><link>https://www.eia.gov/a</link><pubDate>Sat, 24 Oct 2026 12:00:00 GMT</pubDate></item>
  <item><title>Gasoline prices change this week</title><link>https://www.eia.gov/b</link><pubDate>Sat, 24 Oct 2026 12:00:00 GMT</pubDate></item>
  <item><title>Wind project</title><link>https://example.com/other</link><pubDate>Sat, 24 Oct 2026 12:00:00 GMT</pubDate></item>
</channel></rss>`;

test("RSS selection keeps recent clean-energy items from their publisher", () => {
  const items = selectNews(parseFeed(xml, source), new Date("2026-10-25T12:00:00Z"));
  assert.deepEqual(items.map(({ title, url }) => [title, url]), [
    ["Wind turbines supply clean electricity to data centres", "https://www.eia.gov/a"],
  ]);
});

test("RSS selection removes duplicate and stale items", () => {
  const item = parseFeed(xml, source)[0];
  const old = { ...item, publishedAt: "2026-01-01T00:00:00.000Z" };
  assert.equal(selectNews([item, item, old], new Date("2026-10-25T12:00:00Z")).length, 1);
});

test("bad feed dates and unrelated AI energy stories do not reach the screen", () => {
  const badDate = xml.replace("Sat, 24 Oct 2026 12:00:00 GMT", "not a date");
  assert.equal(selectNews(parseFeed(badDate, source), new Date("2026-10-25T12:00:00Z")).length, 0);
  const fossil = { ...parseFeed(xml, source)[0], title: "AI data centre powered by natural gas", description: "", url: "https://www.eia.gov/c" };
  assert.equal(selectNews([fossil], new Date("2026-10-25T12:00:00Z")).length, 0);
});

test("a failed publisher feed does not hide the other publisher", async () => {
  const originalFetch = globalThis.fetch;
  const currentXml = xml.replaceAll("Sat, 24 Oct 2026 12:00:00 GMT", new Date().toUTCString());
  globalThis.fetch = async (url) => {
    if (url.includes("energy.gov")) throw new Error("publisher unavailable");
    return new Response(currentXml, { status: 200 });
  };
  try {
    const items = await fetchLatestNews();
    assert.equal(items.length, 1);
  } finally { globalThis.fetch = originalFetch; }
});
