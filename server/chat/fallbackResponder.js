// Answers without an LLM (no API key, or the provider is down). Uses the same tools,
// so the facts stay grounded; only the wording is templated.

import { liveStatus, generationHistory, webSearch, isWebSearchEnabled } from "./tools/index.js";
import { triggerScreen } from "./tools/bigScreen.js";

const fmt = (n) => Number(n || 0).toLocaleString("en-GB");

// Patterns are typo-tolerant ("yesterdat", "spining", "yday") because visitors type fast
// on phones; carried over from the original intent router.
const INTENTS = [
  { name: "screen", test: /show|inside|look in|open (it|up)|zoom|x-?ray|cut ?away/i },
  { name: "records", test: /record|best|highest|peak|most ever|maximum|max (speed|power)|all[- ]time|storm/i },
  { name: "history", test: /yesterd|yday|last (night|24)|past (day|24 ?h)|previous day/i },
  { name: "compare", test: /compare|difference|month|august|september|trend|more energy/i },
  { name: "live", test: /now|right now|today|current|live|spin+ing|speed|fast|wind|power|homes|rpm|generat|status/i },
];

async function answerFor(intent, prompt, ctx) {
  switch (intent) {
    case "screen": {
      const result = await triggerScreen(ctx.screen, /close|shut/i.test(prompt) ? "close_inside" : "look_inside");
      if (result.ok) ctx.onAction?.(result.action);
      return result.ok
        ? "Look up at the big screen! 👀 I'm opening myself up so you can see my **generator**, **yaw drives** and the **ladder** inside my tower."
        : `I'd love to show you, but ${result.reason.charAt(0).toLowerCase()}${result.reason.slice(1)}`;
    }
    case "records": {
      const r = await generationHistory.run({ period: "records" });
      const lines=[];
      if(r?.peak_power?.power_max_kw!=null)lines.push(`- **Peak power:** ${fmt(r.peak_power.power_max_kw)} kW`);
      if(r?.peak_wind?.wind_max_ms!=null)lines.push(`- **Strongest gust:** ${r.peak_wind.wind_max_ms} m/s`);
      if(r?.highest_daily_energy?.energy_kwh!=null)lines.push(`- **Best day:** ${fmt(Math.round(r.highest_daily_energy.energy_kwh))} kWh${r.energy_method ? ' (estimated)' : ''}`);
      return lines.length ? `${r.scope==='stored history' ? 'Records for my stored history' : 'My all-time bests so far'}:\n\n${lines.join('\n')}` : 'I have no stored record figures available right now.';
    }
    case "history": {
      const d = await generationHistory.run({ period: "last_24_hours" });
      if (d?.energy_kwh != null) return `Over ${d.period || 'my most recent 24 hours of data'} ${d.energy_method ? 'my estimated net energy was' : 'I made'} **${fmt(d.energy_kwh)} kWh**.${d.max_power_kw!=null ? ` Peak power was **${fmt(d.max_power_kw)} kW**.` : ''}${d.avg_wind_ms!=null ? ` Winds averaged **${d.avg_wind_ms} m/s**.` : ''}${d.coverage_pct!=null ? ` Coverage: ${Math.round(d.coverage_pct)}% of the period.` : ''}`;
      return "I can't reach my history database right now, but I can tell you what I'm doing live — just ask!";
    }
    case "compare": {
      const c = await generationHistory.run({ period: "monthly_comparison" });
      const m = c?.monthly_comparison;
      if (m) return `Month by month: I made **${fmt(m.august_2026?.energy_kwh)} kWh** in August and **${fmt(m.september_2026?.energy_kwh)} kWh** in September (${m.delta_energy_pct > 0 ? "+" : ""}${m.delta_energy_pct}%).`;
      return "My monthly comparison isn't available right now.";
    }
    case "live": {
      const s = await liveStatus.run();
      const label=s.data_mode==='live' ? '' : `These are ${s.data_mode}. `;
      if (/today|kwh|energy|carbon|co₂/i.test(prompt)) return `${label}Today's ${s.today_energy_method.startsWith('estimated') ? 'estimated ' : ''}${s.today_data_stale ? 'last known ' : ''}energy is **${fmt(s.today_energy_kwh)} kWh** so far. That corresponds to about **${fmt(s.today_co2_avoided_kg)} kg of CO₂ avoided**.`;
      if (!s.spinning) return `${label}The wind is a **${s.wind_description.toLowerCase()}** at **${s.wind_speed_ms} m/s**, so I'm resting and waiting for a stronger gust. Today's ${s.today_data_stale ? 'last known ' : ''}energy is **${fmt(s.today_energy_kwh)} kWh** so far.`;
      return `${label}I'm making **${fmt(s.power_kw)} kW** — enough for about **${fmt(s.homes_powered_now)} homes**. The wind is **${s.wind_speed_ms} m/s** and my blade tips are moving at about **${s.blade_tip_speed_mph} mph**!`;
    }
    default: {
      if (!isWebSearchEnabled()) {
        return "I can tell you what I'm doing right now — how much power I'm making, the wind, today's total, my records — but I can't look up other facts at the moment. Try asking about my live numbers!";
      }
      ctx.onStatus?.("Searching the web for that…");
      const found = await webSearch.run({ query: `Lawrence Weston Ambition Community Energy wind turbine ${prompt}` }, ctx);
      if (found.error || (!found.answer && !found.results?.length)) {
        return "I couldn't find a reliable answer to that just now. Ask me about my live numbers instead, or try rephrasing!";
      }
      const lead = found.answer || found.results[0].snippet;
      const links = found.results.slice(0, 3).map((r) => `- [${r.title}](${r.url})`).join("\n");
      return `${lead}\n\n**Sources**\n${links}`;
    }
  }
}

/** Streams a templated answer word by word so the phone UI behaves the same as with an LLM. */
export async function respondWithoutLlm(prompt, ctx) {
  const intent = INTENTS.find((i) => i.test.test(prompt))?.name || "knowledge";
  ctx.onStatus?.("Checking my sensors…");
  const text = await answerFor(intent, prompt, ctx);
  const words = text.split(/(?<=\s)/); // keep each word with its trailing space
  for (const w of words) {
    if (ctx.signal?.aborted) break;
    ctx.onText(w);
    await new Promise((r) => setTimeout(r, 14));
  }
  return text;
}
