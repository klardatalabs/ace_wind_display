// Picks a chapter's words for this time round the story and fills in the live figures.
// Variants rotate each loop: fresh ones from the server first (when it has any), then the
// hand-written ones from screens.js, so the words differ on every pass.

import { fillStory } from "@shared/stories.js";
import { formatInt } from "../lib/format.js";

const mph = (ms) => ms * 2.23694;
const POINTS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
const compassName = (deg) => POINTS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

/** Display text for every placeholder a sentence may use (see shared/stories.js). */
export function storyValues(d) {
  return {
    power: `${d.power.value} ${d.power.unit}`,
    homes: formatInt(d.homes),
    wind: `${Math.round(mph(d.windSpeed))} mph`,
    windFrom: compassName(d.windDir ?? 0),
    rpm: `${d.rotorRpm.toFixed(1)} rpm`,
    tip: `${formatInt(d.tipMph)} mph`,
    today: `${d.today.value} ${d.today.unit}`,
    carbon: `${formatInt(d.co2Kg)} kg`,
    lifetime: `${d.lifetime.value} ${d.lifetime.unit}`,
    share: `${Math.round(d.utilisation)}%`,
    hubHeight: "92 m",
    tipHeight: "150 m",
    bladeLength: "56 m",
    rated: "4.2 MW",
  };
}

/** Below this the turbine reads as becalmed, and "now" uses its calm words. */
const WORKING_KW = 10;

function variantsFor(chapter, generated, working) {
  const pick = (copy) => (Array.isArray(copy) ? copy : copy?.[working ? "working" : "calm"]) ?? [];
  return [...pick(generated?.[chapter.id]), ...pick(chapter.copy)];
}

/**
 * The chapter as the caption shows it: its words for `loop` (the number of times the story
 * has come round), with placeholders filled from live data. Chapters without `copy` (the
 * story rail) pass through unchanged.
 */
export function resolveChapter(chapter, loop, data, generated) {
  if (!chapter.copy) return chapter;
  const variants = variantsFor(chapter, generated, data.powerKw >= WORKING_KW);
  const v = variants[loop % variants.length];
  const fill = (text) => (d) => fillStory(text, storyValues(d));
  return { ...chapter, id: `${chapter.id}:${loop}`, eyebrow: fillStory(v.eyebrow, storyValues(data)), line: fill(v.line), sub: fill(v.sub) };
}
