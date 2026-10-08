const nf = new Intl.NumberFormat("en-GB");

export const formatInt = (n) => nf.format(Math.round(n || 0));

export function formatEnergy(kwh) {
  if (kwh >= 1_000_000) return { value: (kwh / 1_000_000).toFixed(2), unit: "GWh" };
  if (kwh >= 10_000) return { value: (kwh / 1000).toFixed(1), unit: "MWh" };
  return { value: formatInt(kwh), unit: "kWh" };
}

export function formatPower(kw) {
  if (kw >= 1000) return { value: (kw / 1000).toFixed(2), unit: "MW" };
  return { value: formatInt(kw), unit: "kW" };
}

export const compassPoint = (deg) => ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round((((deg % 360) + 360) % 360) / 45) % 8];
