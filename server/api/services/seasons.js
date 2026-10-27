import { pool } from "../../infra/postgres.js";
import { ASSET } from "../../../shared/site.js";

const LABELS = ["Winter", "Spring", "Summer", "Autumn"];
const DIRECTIONS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function comparisonYear(latestObservation) {
  return new Date(latestObservation).getUTCFullYear();
}

export function seasonWindows(year) {
  const starts = [
    `${year - 1}-12-01T00:00:00Z`,
    `${year}-03-01T00:00:00Z`,
    `${year}-06-01T00:00:00+01:00`,
    `${year}-09-01T00:00:00+01:00`,
    `${year}-12-01T00:00:00Z`,
  ];
  return LABELS.map((name, i) => ({
    name,
    from: starts[i],
    to: starts[i + 1],
    expectedSamples: Math.round((Date.parse(starts[i + 1]) - Date.parse(starts[i])) / 600_000),
  }));
}

export function summarizeSeasons(rows, year) {
  return seasonWindows(year).map((window, index) => {
    const seasonRows = rows.filter((row) => Number(row.season) === index);
    const observations = seasonRows.reduce((sum, row) => sum + Number(row.samples), 0);
    const speedSamples = seasonRows.reduce((sum, row) => sum + Number(row.speed_samples), 0);
    const speedSum = seasonRows.reduce((sum, row) => sum + Number(row.speed_sum || 0), 0);
    const directions = DIRECTIONS.map((name, bin) => ({
      name,
      samples: seasonRows.filter((row) => row.direction_bin != null && Number(row.direction_bin) === bin)
        .reduce((sum, row) => sum + Number(row.samples), 0),
    }));
    const dominant = [...directions].sort((a, b) => b.samples - a.samples)[0];
    return {
      ...window,
      observations,
      samples: speedSamples,
      coveragePct: Math.round((speedSamples / window.expectedSamples) * 1000) / 10,
      meanSpeedMs: speedSamples ? Math.round((speedSum / speedSamples) * 10) / 10 : null,
      dominantDirection: dominant.samples ? dominant.name : null,
      directions,
    };
  });
}

export async function seasons(now = new Date()) {
  const latest = await pool.query("SELECT max(observed_at) AS observed_at FROM ts.scada_10m WHERE asset_id = $1", [ASSET.id]);
  const latestObservation = latest.rows[0]?.observed_at;
  if (!latestObservation) return { year: null, source: "ACE 10-minute turbine history", directionMethod: "Nacelle heading, a proxy for wind direction", seasons: [] };
  const year = comparisonYear(latestObservation);
  const windows = seasonWindows(year);
  const { rows } = await pool.query(
    `SELECT CASE
       WHEN observed_at < $3::timestamptz THEN 0
       WHEN observed_at < $4::timestamptz THEN 1
       WHEN observed_at < $5::timestamptz THEN 2
       ELSE 3 END AS season,
       CASE WHEN nacelle_position_deg IS NULL THEN NULL
         ELSE floor((nacelle_position_deg + 22.5) / 45)::int % 8 END AS direction_bin,
       count(*) AS samples,
       count(wind_speed_mean_ms) AS speed_samples,
       sum(wind_speed_mean_ms) AS speed_sum
     FROM ts.scada_10m
     WHERE asset_id = $1 AND observed_at >= $2::timestamptz AND observed_at < $6::timestamptz
     GROUP BY 1, 2`,
    [ASSET.id, windows[0].from, windows[1].from, windows[2].from, windows[3].from, windows[3].to]
  );
  return { year, latestObservation, source: "ACE 10-minute turbine history", directionMethod: "Nacelle heading, a proxy for wind direction", seasons: summarizeSeasons(rows, year) };
}
