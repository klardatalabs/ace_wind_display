// Answers without a language model (none configured, or the provider is down). Same tools,
// same activity-graph steps; only the wording is templated. For learning questions the
// books and photos are searched in parallel and the best passage is quoted, so visitors can
// still learn something.

import { runStep } from "./agent.js";
import { photosEnabled } from "../integrations/unsplash.js";

const fmt = (n) => Number(n ?? 0).toLocaleString("en-GB");
const INTENTS = [
  { name: "screen", test: /\b(show|look inside|open (it|up)|zoom|x-?ray|cut ?away)\b/i },
  { name: "records", test: /record|best|highest|peak|most ever|all[- ]time/i },
  { name: "history", test: /yesterd|yday|last (night|24)|past (day|24 ?h)/i },
  { name: "months", test: /month|compare|trend/i },
  { name: "live", test: /\b(now|right now|today|current|live|spinning|how fast|homes|rpm|generating|output)\b/i },
];

async function answerFor(intent, question, ctx) {
  const step = (name, args) => runStep({ name, args, round: 1, id: `fallback-${name}` }, ctx);
  switch (intent) {
    case "screen": {
      const r = await step("show_on_big_screen", { action: /close|shut/i.test(question) ? "close_inside" : "look_inside" });
      return r.ok ? "Look up at the big screen! 👀 I'm opening myself up so you can see my **generator**, **yaw drives** and the **ladder** inside my tower." : `I'd love to show you, but ${r.reason}`;
    }
    case "records": {
      const r = await step("get_generation_history", { period: "records" });
      const lines = [];
      if (r?.peak_power?.power_max_kw != null) lines.push(`- **Peak power:** ${fmt(r.peak_power.power_max_kw)} kW`);
      if (r?.peak_wind?.wind_max_ms != null) lines.push(`- **Strongest wind:** ${r.peak_wind.wind_max_ms} m/s`);
      if (r?.highest_daily_energy?.energy_kwh != null) lines.push(`- **Best day:** ${fmt(r.highest_daily_energy.energy_kwh)} kWh on ${r.highest_daily_energy.date}`);
      return lines.length ? `My records so far:\n\n${lines.join("\n")}` : "I don't have any stored records to share yet.";
    }
    case "history": {
      const d = await step("get_generation_history", { period: "past_24_hours" });
      return d?.energy_kwh != null
        ? `Over the past 24 hours I made about **${fmt(d.energy_kwh)} kWh** (estimated from my 10-minute readings), peaking at **${fmt(d.max_power_kw)} kW**.`
        : "I can't reach my history right now, but ask me what I'm doing live!";
    }
    case "months": {
      const m = await step("get_generation_history", { period: "months" });
      return m?.this_month?.energy_kwh != null
        ? `This month so far I've made **${fmt(m.this_month.energy_kwh)} kWh**; last month I made **${fmt(m.last_month.energy_kwh)} kWh**.`
        : "My monthly comparison isn't available right now.";
    }
    case "live": {
      const s = await step("get_live_status", {});
      if (s.available === false) return "My live readings aren't coming through right now. Please try again in a minute!";
      const prefix = s.data === "live" ? "" : `(These are my ${s.data}.) `;
      if (!s.spinning) return `${prefix}The wind is a **${s.wind_description.toLowerCase()}** at **${s.wind_speed_ms} m/s**, so I'm resting and waiting for a stronger gust.`;
      return `${prefix}I'm making **${fmt(s.power_kw)} kW**, equivalent to about **${fmt(s.homes_demand_equivalent_estimate)} homes' average demand** at an assumed 0.35 kW per home. The wind is **${s.wind_speed_ms} m/s** and my blade tips are moving at about **${s.blade_tip_speed_mph} mph**!`;
    }
    default: {
      const [books] = await Promise.all([
        step("search_research", { query: question }),
        photosEnabled() ? step("show_photos", { query: `wind turbine ${question}`.slice(0, 80), count: 3 }) : null,
      ]);
      const best = books?.passages?.[0];
      if (!best) return "That's a great question! I can't look it up right now; try asking about what I'm doing live.";
      const text = best.text.split("\n").slice(1).join(" ").trim() || best.text;
      const excerpt = text.split(/\s+/).slice(0, 20).join(" ");
      return `One source I found is *${best.title}*${best.pages ? ` (${best.pages})` : ""}. Excerpt: “${excerpt}${excerpt.length < text.length ? "…" : ""}”${best.sourceUrl ? `\n\nSource: ${best.sourceUrl}` : ""}`;
    }
  }
}

/** Streams a templated answer word by word, so the phone behaves as it does with a model. */
export async function respondWithoutLlm(question, ctx, signal) {
  const intent = INTENTS.find((i) => i.test.test(question))?.name ?? "learn";
  const text = await answerFor(intent, question, ctx);
  for (const word of text.split(/(?<=\s)/)) {
    if (signal?.aborted) break;
    ctx.emit("token", { t: word });
    await new Promise((r) => setTimeout(r, 12));
  }
  return text;
}
