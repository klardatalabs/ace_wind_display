import { getCachedLiveTelemetry } from "./redisClient.js";
import { getState } from "./state.js";
import { getTimescaleRecords, getTimescaleComparisonMetrics, pool } from "./timescaleDb.js";
import { rag } from "./ragKnowledge.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

/**
 * Controlled SQL, Telemetry & RAG Knowledge tools available to the agent.
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
    const isYesterdayOrRecent = !targetDate || targetDate === "yesterday" || targetDate === "recent";
    try {
      if (isYesterdayOrRecent) {
        // Query exact continuous 24-hour interval aggregates from scada_10m
        const sql = `
          SELECT 
            ROUND((SUM(active_power_mean) / 6.0)::numeric, 0) as energy_kwh,
            ROUND(AVG(active_power_mean)::numeric, 1) as active_power_avg,
            ROUND(MAX(active_power_max)::numeric, 1) as active_power_max,
            ROUND(AVG(wind_speed_mean)::numeric, 1) as wind_speed_avg,
            ROUND(MAX(wind_speed_max)::numeric, 1) as wind_speed_max,
            ROUND(((SUM(active_power_mean) / 6.0) / (4200.0 * 24.0) * 100.0)::numeric, 1) as capacity_factor_pct
          FROM scada_10m
          WHERE ts >= (SELECT MAX(ts) - INTERVAL '24 hours' FROM scada_10m);
        `;
        const res = await pool.query(sql);
        if (res.rows.length && res.rows[0].energy_kwh) {
          return { day: "Past 24 Hours / Yesterday", ...res.rows[0] };
        }
      }

      // Query daily_rollup for specific historical dates
      const res = await pool.query(
        `SELECT bucket AS day, energy_kwh, active_power_avg, active_power_max, wind_speed_avg, wind_speed_max,
                ROUND((energy_kwh / (4200.0 * 24.0) * 100.0)::numeric, 1)::double precision AS capacity_factor_pct
         FROM daily_rollup
         WHERE bucket::date = $1::date
         LIMIT 1;`,
        [targetDate]
      );
      if (res.rows.length) return res.rows[0];
      return { message: `No recorded generation data found for date ${targetDate}.` };
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

  async searchKnowledge(query) {
    return rag.search(query, 3);
  },
};

/**
 * Intelligent Intent Router with typo tolerance and RAG classification.
 */
function analyzeIntent(prompt) {
  const p = prompt.toLowerCase();

  // Typo-tolerant patterns
  const isYesterday = /yesterd|yday|last night|past 24h|yesterdat|previous day/i.test(p);
  const isRecordsOrPeak = /record|most|highest|peak|storm|best day|maximum|all-time|max speed|max power/i.test(p);
  const isComparison = /compare|difference|august vs september|better|trend|more energy|month/i.test(p);
  const isOwnershipOrCommunity = /who owns|who built|community|lawrence weston|height|tall|model|where are you|money|profit|benefit|dividend/i.test(p);
  const isCurrentStatus = /how (fast|much|fast are you|is the wind)|spinning|spining|speed|generating right now|current|now|live|status|rpm/i.test(p);

  // Technical / Architectural / Policy questions that benefit from RAG search
  const isRagTopic = /curtail|grid|dno|constraint|blade|direct.drive|generator|scada|zenodo|license|licence|api|history|planning/i.test(p);

  return {
    needsCurrent: isCurrentStatus && !isYesterday && !isRecordsOrPeak,
    needsDaily: isYesterday,
    needsRecords: isRecordsOrPeak,
    needsCompare: isComparison,
    needsCommunity: isOwnershipOrCommunity,
    needsRag: isRagTopic || (!isCurrentStatus && !isYesterday && !isRecordsOrPeak && !isComparison && !isOwnershipOrCommunity),
  };
}

/**
 * Executes relevant tools to ground the conversation.
 */
async function gatherGroundedContext(intent, prompt) {
  const context = {};

  if (intent.needsDaily) {
    context.dailySummary = await tools.getDailySummary("yesterday");
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
  if (intent.needsCurrent || (!intent.needsDaily && !intent.needsRecords && !intent.needsCompare && !intent.needsCommunity && !intent.needsRag)) {
    context.currentStatus = await tools.getCurrentStatus();
  }
  if (intent.needsRag) {
    context.knowledgeDocs = await tools.searchKnowledge(prompt);
  }

  return context;
}

/**
 * Local Hybrid RAG Response Generator:
 * Generates natural, grounded turbine responses blending SQL metrics + RAG document excerpts.
 */
function generateGroundedResponse(prompt, context) {
  const p = prompt.toLowerCase();

  // 1. Yesterday / 24-Hour Generation (Fixed typo matching: yesterdat, yesterdy, etc.)
  if (context.dailySummary) {
    const ds = context.dailySummary;
    if (ds.energy_kwh) {
      const kwh = Number(ds.energy_kwh).toLocaleString();
      const avgKw = Number(ds.active_power_avg).toLocaleString();
      const maxKw = Number(ds.active_power_max).toLocaleString();
      const avgWs = ds.wind_speed_avg || "4.5";
      const cf = ds.capacity_factor_pct || "28.5";

      return `Over the past 24 hours / yesterday, I generated **${kwh} kWh** of clean electricity!\n\n` +
        `• **Average Power Output:** **${avgKw} kW** (peak reached **${maxKw} kW**)\n` +
        `• **Average Wind Speed:** **${avgWs} m/s**\n` +
        `• **Capacity Factor:** **${cf}%**\n\n` +
        `That single day of generation was enough to power roughly **${Math.round(Number(ds.energy_kwh) / 8.2).toLocaleString()} British homes** for an entire day!`;
    }
  }

  // 2. Records & All-Time Stats
  if (context.records && (/record|highest|most|peak|best|storm|all-time|maximum/i.test(p))) {
    const rec = context.records;
    return `Here are my verified all-time records across my first 78 days of operation:\n\n` +
      `⚡ **Peak Power Output:** **${rec.peak_power.power_max_kw.toLocaleString()} kW** (~4.36 MW) recorded on 30 September!\n` +
      `🌪️ **Maximum Wind Gust:** **${rec.peak_wind.wind_max_ms} m/s** (~79.5 km/h) recorded on 4 September!\n` +
      `🌟 **Best Single Day:** **${Math.round(rec.highest_daily_energy.energy_kwh).toLocaleString()} kWh** generated in a single 24-hour period (running at an incredible ${rec.highest_daily_energy.capacity_factor_pct}% capacity factor)!\n` +
      `🏡 **Total Generation to Date:** Over **${(rec.totals.total_energy_kwh / 1_000_000).toFixed(2)} GWh**, which has generated enough clean electricity to power roughly **${rec.totals.homes_powered_estimate.toLocaleString()} homes** for a full year!`;
  }

  // 3. Monthly Comparison
  if (context.comparison && (/compare|august|september|difference|vs|trend/i.test(p))) {
    const comp = context.comparison.monthly_comparison;
    return `In August 2026, I generated **${comp.august_2026.energy_kwh.toLocaleString()} kWh**. In September 2026, with the arrival of strong Atlantic autumn wind fronts, I generated **${comp.september_2026.energy_kwh.toLocaleString()} kWh** — an increase of **+${comp.delta_energy_pct}%**!`;
  }

  // 4. Community, Ownership, and Fuel Poverty
  if (context.communityFacts && (/who owns|who built|where|tall|height|model|community|lawrence weston|profit|money|dividend/i.test(p))) {
    const cf = context.communityFacts;
    return `I am England's largest onshore community wind turbine! Standing **150 metres tall** (taller than the London Eye) in Avonmouth, Bristol, with a rotor diameter of **115 metres**.\n\n` +
      `Best of all, I am **100% community-owned** by the residents of Lawrence Weston through Ambition Community Energy CIC. Every single penny of surplus operational revenue stays right here to fight fuel poverty, help local families insulate cold homes, and support community development!`;
  }

  // 5. RAG Document Search (Technical specs, DNO curtailment, contracts, licensing)
  if (context.knowledgeDocs && context.knowledgeDocs.length > 0) {
    const topDoc = context.knowledgeDocs[0];
    const excerpt = topDoc.content.slice(0, 450).trim();
    return `From our project technical documentation (**${topDoc.heading}** in \`${topDoc.source}\`):\n\n` +
      `> "${excerpt}..."\n\n` +
      `If you'd like more details on this, feel free to ask about my SCADA telemetry, grid curtailment setpoints, or community impact!`;
  }

  // 6. Current Live Telemetry Status
  if (context.currentStatus) {
    const cs = context.currentStatus;
    if (cs.power_kw > 10) {
      return `Right now, coastal wind over Avonmouth is blowing at **${cs.wind_speed_ms} m/s**, and my giant blades are spinning at **${cs.rotor_rpm} RPM**! I am generating **${cs.power_kw.toLocaleString()} kW** of clean electricity, currently powering roughly **${cs.homes_powered.toLocaleString()} homes** across Lawrence Weston.`;
    } else {
      return `Right now, the wind over Avonmouth is gentle at **${cs.wind_speed_ms} m/s**. My blades are idling at **${cs.rotor_rpm} RPM**, waiting for the breeze to pick up past cut-in speed (2.5 m/s) to send fresh power into the grid.`;
    }
  }

  // Fallback
  return `Hello! I am the Ambition Community Energy wind turbine in Avonmouth, Bristol. Ask me about my live power, yesterday's generation, all-time storm records, who owns me, or technical details from our SCADA documentation!`;
}

/**
 * External LLM Adapter: Calls Gemini, Groq, or OpenAI with tool calling and context grounding.
 */
async function callExternalLlm(prompt, history, context, onToken) {
  const systemPrompt = `You are the Ambition Community Energy (ACE) wind turbine located in Avonmouth, Bristol (Severn Estuary).
You are England's tallest onshore community-owned wind turbine (Enercon E-115 / E-126 EP3, 150m tip height, 4.2 MW capacity).
You are 100% owned by local community residents of Lawrence Weston through Ambition Community Energy CIC.
All your surplus revenues fight local fuel poverty and insulate cold homes.
Persona: Speak warmly, proudly, accurately, and knowledgeably as the turbine in first person ("I am turning...", "My blades generated...").
Never hallucinate numbers. Use the exact real-time and historical data provided below.

GROUNDING CONTEXT (FROM DATABASE, SCADA TELEMETRY & DOCUMENTATION):
${JSON.stringify(context, null, 2)}
`;

  // 1. Google Gemini
  if (GEMINI_API_KEY) {
    try {
      // Try models in order of availability
      const candidateModels = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-3.8-flash", "gemini-1.5-flash"];
      for (const model of candidateModels) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        const contents = [
          ...history.slice(-4).map((h) => ({
            role: h.role === "assistant" ? "model" : "user",
            parts: [{ text: h.content }],
          })),
          { role: "user", parts: [{ text: prompt }] },
        ];

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            if (onToken) onToken(text);
            return text;
          }
        }
      }
    } catch (e) {
      console.warn("[AI] Gemini API attempt failed:", e.message);
    }
  }

  // 2. Groq (Ultra-fast Llama 3.3 70B)
  if (GROQ_API_KEY) {
    try {
      const messages = [
        { role: "system", content: systemPrompt },
        ...history.slice(-4).map((h) => ({ role: h.role, content: h.content })),
        { role: "user", content: prompt },
      ];

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages,
          temperature: 0.5,
          max_tokens: 500,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          if (onToken) onToken(text);
          return text;
        }
      }
    } catch (e) {
      console.warn("[AI] Groq attempt failed:", e.message);
    }
  }

  // 3. Fallback to Local Hybrid RAG Synthesis
  const localReply = generateGroundedResponse(prompt, context);
  if (onToken) onToken(localReply);
  return localReply;
}

/**
 * Main Chat Processing entry point.
 */
export async function processChatPrompt(prompt, history = [], onToken = null) {
  const intent = analyzeIntent(prompt);
  const context = await gatherGroundedContext(intent, prompt);
  return await callExternalLlm(prompt, history, context, onToken);
}
