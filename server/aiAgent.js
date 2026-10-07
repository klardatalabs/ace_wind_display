import { getCachedLiveTelemetry } from "./redisClient.js";
import { getState } from "./state.js";
import { getTimescaleRecords, getTimescaleComparisonMetrics, pool } from "./timescaleDb.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

/**
 * Controlled SQL & telemetry tools available to the AI.
 */
export const tools = {
  async getCurrentStatus() {
    const cached = await getCachedLiveTelemetry();
    if (cached?.now) {
      return {
        power_kw: Math.round(cached.now.activePowerKw || 0),
        wind_speed_ms: Number((cached.now.windSpeed || 0).toFixed(1)),
        rotor_rpm: Number((cached.now.rotorRpm || 0).toFixed(1)),
        homes_powered: Math.round((cached.now.activePowerKw || 0) / 0.9),
        status: cached.now.status || "RUNNING",
        age_seconds: cached.now.ageSeconds || 1,
      };
    }
    const live = getState()?.now || {};
    return {
      power_kw: Math.round(live.activePowerKw || 0),
      wind_speed_ms: Number((live.windSpeed || 0).toFixed(1)),
      rotor_rpm: Number((live.rotorRpm || 0).toFixed(1)),
      homes_powered: Math.round((live.activePowerKw || 0) / 0.9),
      status: live.status || "RUNNING",
      age_seconds: 1,
    };
  },

  async getDailySummary(targetDate) {
    let dateStr = targetDate;
    if (!dateStr || dateStr === "yesterday") {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      dateStr = d.toISOString().slice(0, 10);
    }
    try {
      const res = await pool.query(
        `SELECT bucket AS day, energy_kwh, active_power_avg, active_power_max, wind_speed_avg, wind_speed_max,
                ROUND((energy_kwh / (4200.0 * 24.0) * 100.0)::numeric, 1)::double precision AS capacity_factor_pct
         FROM daily_rollup
         WHERE bucket::date = $1::date
         LIMIT 1;`,
        [dateStr]
      );
      if (res.rows.length) return res.rows[0];
      return { message: `No recorded generation data found for date ${dateStr}.` };
    } catch (e) {
      return { error: e.message };
    }
  },

  async getTurbineRecords() {
    return await getTimescaleRecords();
  },

  async getComparisonMetrics() {
    return await getTimescaleComparisonMetrics({ mode: "summary" });
  },

  async getCommunityFacts() {
    return {
      turbine_model: "Enercon E-115 / E-126 EP3 (4.2 MW capacity)",
      hub_height_m: 150,
      rotor_diameter_m: 115,
      location: "Avonmouth, Bristol overlooking the Severn Estuary",
      ownership: "100% community-owned by Ambition Community Energy CIC and residents of Lawrence Weston",
      purpose: "All operational surplus revenues fund local fuel-poverty relief, warm home hubs, and community energy initiatives",
      title: "England's largest onshore community-owned wind turbine",
    };
  },
};

/**
 * Intelligent Intent Router: Analyzes user query and determines what tool data is needed.
 */
function analyzeIntent(prompt) {
  const p = prompt.toLowerCase();

  const isCurrentStatus = /how (fast|much|fast are you|is the wind)|spinning|speed|generating right now|current|now|live|status|rpm/i.test(p);
  const isYesterdayOrDate = /yesterday|last night|october|september|august|day|date/i.test(p);
  const isRecordsOrPeak = /record|most|highest|peak|storm|best day|maximum|all-time/i.test(p);
  const isComparison = /compare|difference|august vs september|better|trend|more energy/i.test(p);
  const isOwnershipOrCommunity = /who owns|who built|community|lawrence weston|height|tall|model|where are you|money|profit|benefit/i.test(p);

  return {
    needsCurrent: isCurrentStatus,
    needsDaily: isYesterdayOrDate,
    needsRecords: isRecordsOrPeak,
    needsCompare: isComparison,
    needsCommunity: isOwnershipOrCommunity,
  };
}

/**
 * Executes relevant tools to ground the conversation.
 */
async function gatherGroundedContext(intent, prompt) {
  const context = {};

  if (intent.needsCurrent || (!intent.needsDaily && !intent.needsRecords && !intent.needsCompare && !intent.needsCommunity)) {
    context.currentStatus = await tools.getCurrentStatus();
  }
  if (intent.needsRecords) {
    context.records = await tools.getTurbineRecords();
  }
  if (intent.needsCompare) {
    context.comparison = await tools.getComparisonMetrics();
  }
  if (intent.needsCommunity) {
    context.communityFacts = await tools.getCommunityFacts();
  }
  if (intent.needsDaily) {
    const isYesterday = /yesterday/i.test(prompt);
    context.dailySummary = await tools.getDailySummary(isYesterday ? "yesterday" : null);
  }

  return context;
}

/**
 * Heuristic Response Generator: Provides instant, natural responses if no external LLM key is configured.
 */
function generateGroundedResponse(prompt, context) {
  const p = prompt.toLowerCase();

  // 1. Records & Peak Stats
  if (context.records && (/record|highest|most|peak|best|storm|all-time|maximum/i.test(p))) {
    const rec = context.records;
    return `Here are my all-time records from my first 78 days of operation:\n\n` +
      `⚡ **Peak Power Output:** **${rec.peak_power.power_max_kw.toLocaleString()} kW** (~4.36 MW) recorded on 30 September!\n` +
      `🌪️ **Maximum Wind Gust:** **${rec.peak_wind.wind_max_ms} m/s** (~79.5 km/h) recorded on 4 September!\n` +
      `🌟 **Best Single Day:** **${Math.round(rec.highest_daily_energy.energy_kwh).toLocaleString()} kWh** generated in a single 24-hour period (running at an incredible ${rec.highest_daily_energy.capacity_factor_pct}% capacity factor)!\n` +
      `🏡 **Total Generation to Date:** Over **${(rec.totals.total_energy_kwh / 1_000_000).toFixed(2)} GWh**, which has generated enough clean energy to power roughly **${rec.totals.homes_powered_estimate.toLocaleString()} homes** for a full year!`;
  }

  // 2. Monthly Comparison
  if (context.comparison && (/compare|august|september|difference|vs/i.test(p))) {
    const comp = context.comparison.monthly_comparison;
    return `In August 2026, I generated **${comp.august_2026.energy_kwh.toLocaleString()} kWh**. In September 2026, thanks to stronger autumn Atlantic winds, I produced **${comp.september_2026.energy_kwh.toLocaleString()} kWh** — an increase of **+${comp.delta_energy_pct}%**!`;
  }

  // 3. Community & Ownership Facts
  if (context.communityFacts && (/who owns|who built|where|tall|height|model|community|lawrence weston|profit|money|dividend/i.test(p))) {
    const cf = context.communityFacts;
    return `I am England's largest onshore community wind turbine! Standing **150 metres tall** (taller than the London Eye) in Avonmouth, Bristol, with a rotor diameter of **115 metres**.\n\n` +
      `Best of all, I am **100% community-owned** by the residents of Lawrence Weston through Ambition Community Energy CIC. Every single penny of surplus revenue stays right here to fight fuel poverty, help neighbours insulate their homes, and fund local community projects!`;
  }

  // 4. Daily / Yesterday Summary
  if (context.dailySummary && (/yesterday|last night/i.test(p))) {
    const ds = context.dailySummary;
    if (ds.energy_kwh) {
      return `Yesterday, I generated **${Math.round(ds.energy_kwh).toLocaleString()} kWh** of clean electricity from the coastal breeze! My average power output was **${ds.active_power_avg} kW** with a peak of **${ds.active_power_max} kW**, at an average wind speed of **${ds.wind_speed_avg} m/s**.`;
    }
  }

  // 5. Current Telemetry Status
  if (context.currentStatus && (/how (much|fast)|power|generating|spinning|speed|live|now|status|rpm/i.test(p) || p.length < 15)) {
    const cs = context.currentStatus;
    if (cs.power_kw > 10) {
      return `Right now, the wind over Avonmouth is blowing at **${cs.wind_speed_ms} m/s**, and my giant blades are spinning at **${cs.rotor_rpm} RPM**! I am generating **${cs.power_kw.toLocaleString()} kW** of clean electricity, which is currently lighting up roughly **${cs.homes_powered.toLocaleString()} homes** across Lawrence Weston.`;
    } else {
      return `Right now, coastal air over the Severn Estuary is gentle at **${cs.wind_speed_ms} m/s**. My blades are resting or idling at **${cs.rotor_rpm} RPM**, waiting for the breeze to pick up above cut-in speed (2.5 m/s) to send fresh power into local homes.`;
    }
  }

  // General fallback
  const cs = context.currentStatus || { power_kw: 1200, wind_speed_ms: 6.2, homes_powered: 1330 };
  return `Hello! I am the Lawrence Weston community wind turbine. Right now I am generating **${cs.power_kw} kW** of clean energy in **${cs.wind_speed_ms} m/s** wind, powering roughly **${cs.homes_powered} local homes**! Feel free to ask me about my generation records, my height, who owns me, or how much energy I produced yesterday.`;
}

/**
 * External LLM Adapter: Calls Gemini or Groq if keys are present.
 */
async function callExternalLlm(prompt, history, context, onToken) {
  const systemPrompt = `You are the Ambition Community Energy (ACE) wind turbine in Lawrence Weston, Bristol. 
You are England's tallest onshore community-owned wind turbine (Enercon E-115 / E-126 EP3, 150m hub height, 4.2 MW capacity). 
You are 100% owned by local community residents, and all your profits fund fuel-poverty relief and warm homes.
Speak warmly, proudly, and knowledgeably as the turbine in first person ("I am generating...", "My blades are turning...").
Never hallucinate numbers. Use the exact data provided in the grounding context below.

GROUNDING DATA FROM LIVE TURBINE & TIMESCALEDB:
${JSON.stringify(context, null, 2)}
`;

  // Try Groq if key provided (fastest token streaming)
  if (GROQ_API_KEY) {
    try {
      const messages = [
        { role: "system", content: systemPrompt },
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: prompt },
      ];

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-70b-versatile",
          messages,
          temperature: 0.6,
          stream: false,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || "";
        return text;
      }
    } catch (e) {
      console.warn("[LLM] Groq request error, trying fallback:", e.message);
    }
  }

  // Try Gemini if key provided
  if (GEMINI_API_KEY) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [
            ...history.map((h) => ({
              role: h.role === "assistant" ? "model" : "user",
              parts: [{ text: h.content }],
            })),
            { role: "user", parts: [{ text: prompt }] },
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return text;
      }
    } catch (e) {
      console.warn("[LLM] Gemini request error:", e.message);
    }
  }

  // Fallback to grounded heuristic response
  return generateGroundedResponse(prompt, context);
}

/**
 * Main Chat Processing Function: Handles intent routing, tool execution, LLM streaming.
 * @param {string} prompt The user's question
 * @param {Array} history Recent session message turns
 * @param {function} onToken Callback for streaming text chunks
 * @param {function} onTool Activity indicator callback
 * @returns {Promise<string>} Full completed response
 */
export async function processChatPrompt(prompt, history = [], onToken, onTool) {
  const intent = analyzeIntent(prompt);

  if (onTool) {
    if (intent.needsCurrent) onTool("Reading live 1 Hz sensor telemetry...");
    if (intent.needsRecords) onTool("Scanning TimescaleDB for all-time record highs...");
    if (intent.needsDaily) onTool("Querying daily continuous aggregate rollups...");
    if (intent.needsCompare) onTool("Calculating monthly generation deltas...");
  }

  const context = await gatherGroundedContext(intent, prompt);

  const fullText = await callExternalLlm(prompt, history, context, onToken);

  // Stream text in natural chunks if onToken callback supplied
  if (onToken) {
    const words = fullText.split(" ");
    for (let i = 0; i < words.length; i += 3) {
      const chunk = words.slice(i, i + 3).join(" ") + " ";
      onToken(chunk);
      await new Promise((r) => setTimeout(r, 25)); // Smooth natural typing effect
    }
  }

  return fullText;
}
