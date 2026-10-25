import { redis } from "../../infra/redis.js";
import { NEWS_KEY } from "../../live/shapes.js";
import { fetchLatestNews } from "../../news/feed.js";

export async function refreshNews() {
  const items = await fetchLatestNews();
  if (!items.length) throw new Error("News feeds returned no recent matching stories");
  await redis.set(NEWS_KEY, JSON.stringify({ updatedAt: new Date().toISOString(), items }), "EX", 7 * 86400);
}
