// The words on the three hoarding screens. Every screen tells a five-chapter story (hello,
// now, walk, day, ask; the students screen has town in place of day) in its own voice; the
// words change every time the story comes round again. The day chapter tells its hours from real data
// (frontend/src/content/dayStory.js), so only the other four get generated words.
//
// Words come from hand-written variants (frontend/src/content/screens.js) and from fresh
// ones a language model writes now and then (server/collector/jobs/stories.js). Neither
// ever puts a number in the words directly: figures go in as {placeholders}, filled on the
// screen from live data, so a sentence can never show a made-up or out-of-date figure.

export const STORY_AUDIENCES = ["students", "community", "college"];
export const STORY_CHAPTERS = ["hello", "now", "walk", "day", "ask"];
/** The chapters whose words a language model may write. */
export const GENERATED_CHAPTERS = ["hello", "now", "walk", "ask"];

/** The figures a sentence may use, as {name}. Filled on the screen; see fillStory. */
export const STORY_PLACEHOLDERS = {
  greeting: "'Good morning', 'Good afternoon' or 'Good evening', for the time in Bristol",
  power: "what the turbine is making right now, e.g. '1.8 MW'",
  homes: "homes' worth of electricity right now, e.g. '640'",
  wind: "wind speed now, e.g. '14 mph'",
  windFrom: "where the wind comes from, e.g. 'south-west'",
  rpm: "rotor speed now, e.g. '9.4 rpm'",
  tip: "blade-tip speed now, e.g. '120 mph'",
  today: "energy made since midnight, e.g. '12.4 MWh'",
  carbon: "carbon dioxide kept out of the air today, e.g. '2,900 kg'",
  lifetime: "energy made since spring 2023, e.g. '24.1 GWh'",
  share: "share of full power now, e.g. '43%'",
  hubHeight: "'92 m' (hub height)",
  tipHeight: "'150 m' (height to the blade tip)",
  bladeLength: "'56 m' (one blade)",
  rated: "'4.2 MW' (full power)",
};

/** Longest each part may be, in characters (after placeholders are filled, roughly). */
export const STORY_LIMITS = { eyebrow: 28, line: 64, sub: 150 };

const PLACEHOLDER = /\{([a-zA-Z]+)\}/g;

/**
 * Checks one variant: { eyebrow, line, sub } strings, within the limits, no digits outside
 * placeholders, no unknown placeholders, no markup. Returns null when it's fine, else why not.
 */
export function storyProblem(variant) {
  if (!variant || typeof variant !== "object") return "not an object";
  for (const part of ["eyebrow", "line", "sub"]) {
    const text = variant[part];
    if (typeof text !== "string" || !text.trim()) return `${part} is missing`;
    const bare = text.replace(PLACEHOLDER, "");
    if (/\d/.test(bare)) return `${part} has a number outside a placeholder`;
    if (/[<>{}\\`*_#]|https?:/i.test(bare)) return `${part} has markup or a link`;
    for (const [, name] of text.matchAll(PLACEHOLDER)) if (!(name in STORY_PLACEHOLDERS)) return `${part} uses unknown {${name}}`;
    if (text.replace(PLACEHOLDER, "xxxxxx").length > STORY_LIMITS[part]) return `${part} is too long`;
  }
  return null;
}

/** Puts the live figures into a sentence. `values` maps placeholder names to display text. */
export function fillStory(text, values) {
  return text.replace(PLACEHOLDER, (whole, name) => values[name] ?? whole);
}
