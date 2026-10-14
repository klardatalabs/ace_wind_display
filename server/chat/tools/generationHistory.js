// The turbine's stored history: the past day, records, this month against last month, or
// one specific day. Served from the same cache as the website's charts.

import * as history from "../../api/services/history.js";

export const kind = "history";

export const definition = {
  type: "function",
  function: {
    name: "get_generation_history",
    description: "The turbine's stored generation history. period: 'past_24_hours' for yesterday or recent output; 'records' for best day, peak power, strongest wind and totals; 'months' to compare this month with last month; 'date' for one day (give date as YYYY-MM-DD).",
    parameters: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["past_24_hours", "records", "months", "date"] },
        date: { type: "string", description: "YYYY-MM-DD, only when period is 'date'" },
      },
      required: ["period"],
      additionalProperties: false,
    },
  },
};

export async function run({ period, date } = {}) {
  if (period === "records") return history.records();
  if (period === "months") return history.monthComparison();
  if (period === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return { error: "date must be YYYY-MM-DD" };
    return (await history.day(date)) ?? { message: `No stored data for ${date}.` };
  }
  return (await history.pastDay()) ?? { message: "No stored data for the past 24 hours." };
}
