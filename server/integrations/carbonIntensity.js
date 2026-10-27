// The electricity grid around the turbine, from National Grid ESO's Carbon Intensity API
// (api.carbonintensity.org.uk, free, no key): the South West's generation mix and its
// carbon intensity for the current half hour, looked up by the turbine's postcode district.
// The regional intensity is the API's estimate for the half hour (it has no regional
// actuals), so the screens call it an estimate. Cached, since it only changes every 30 min.

const URL_BASE = "https://api.carbonintensity.org.uk";
const POSTCODE = "BS11"; // Lawrence Weston / Avonmouth
const CACHE_MS = 10 * 60_000;
const FUELS = ["wind", "solar", "gas", "nuclear", "imports", "biomass", "hydro", "coal", "other"];

let cached = null; // { at, value }

/** The API's regional JSON -> { region, from, to, intensity, index, mix }. */
export function normaliseRegional(json, now = Date.now()) {
  const region = json?.data?.[0];
  const slot = region?.data?.[0];
  const g = slot?.intensity?.forecast;
  if (!region || !slot || !Number.isFinite(g)) throw new Error("Carbon intensity reading is incomplete");
  if (!Number.isFinite(Date.parse(slot.from)) || !Number.isFinite(Date.parse(slot.to)) ||
      now < Date.parse(slot.from) || now >= Date.parse(slot.to)) throw new Error("Carbon intensity interval is not current");
  const mix = FUELS.map((fuel) => ({ fuel, perc: Number(slot.generationmix?.find((m) => m.fuel === fuel)?.perc) || 0 }));
  return {
    region: String(region.shortname || "South West England"),
    postcode: POSTCODE,
    from: slot.from,
    to: slot.to,
    intensity: g,
    index: String(slot.intensity.index || ""),
    mix,
    source: "Carbon Intensity API regional forecast",
  };
}

/** The grid right now, from the cache when it's fresh. */
export async function fetchRegionalGrid() {
  if (cached && Date.now() - cached.at < CACHE_MS && Date.now() < Date.parse(cached.value.to)) return cached.value;
  const res = await fetch(`${URL_BASE}/regional/postcode/${POSTCODE}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Carbon Intensity API responded ${res.status}`);
  const value = normaliseRegional(await res.json());
  cached = { at: Date.now(), value };
  return value;
}
