// Fresh words for the hoarding screens' stories, written by the language model every so
// often (never per visitor or per loop) and shared through Redis for GET /api/stories.
//
// The screens already have hand-written words, so this is a bonus: anything that doesn't
// pass the checks in shared/stories.js is thrown away whole, and the screens carry on with
// what they have. The model never writes figures; it uses {placeholders} that each screen
// fills from live data.

import { completeChat, llmEnabled } from "../../integrations/llm.js";
import { redis } from "../../infra/redis.js";
import { logger } from "../../lib/logger.js";
import { STORIES_KEY } from "../../live/shapes.js";
import { STORY_AUDIENCES, GENERATED_CHAPTERS, STORY_PLACEHOLDERS, STORY_LIMITS, storyProblem } from "../../../shared/stories.js";

const log = logger("collector.stories");
const VARIANTS = 2;

const FACTS = `Facts you may use (nothing else):
- The turbine is called Ace. It's an Enercon E-115 EP3 in Lawrence Weston (Avonmouth), Bristol.
- It is gearless (direct drive): the rotor turns a ring generator of electromagnets (made with
  electricity; there are no permanent magnets) past copper coils.
- It is owned by the community through Ambition Community Energy; its income supports Ambition
  Lawrence Weston's work in the neighbourhood. It started generating in spring 2023.
- It is one of England's tallest onshore turbines. Inside the tower: a ladder, rest platforms,
  a service lift and power cables. The machine room (nacelle) is at the top.`;

// What each screen actually shows, so captions never point at something that isn't there.
const GROWN_UP_SCREEN =
  "The screen shows the turbine in 3D, a live real-world view, a walk up inside the tower, a day-in-a-minute time-lapse and a QR code that opens a private chat with Ace on a phone.";
const SCREEN_SHOWS = {
  students:
    "The screen shows a cartoon of Ace with a face telling the story in a speech bubble, the turbine in 3D, a race between Ace's blade tips and other fast things, a climb up inside the tower that tells how Ace was built, a page about the town that owns it, and a QR code that opens a private chat with Ace on a phone. There is no map, live camera, quiz or game.",
  community: GROWN_UP_SCREEN,
  college: GROWN_UP_SCREEN,
};

const VOICES = {
  students: "School students aged 7-16. Playful, vivid headlines, simple words, one fun comparison at most. Speak as Ace, in the first person.",
  community: "Lawrence Weston residents and neighbours. Warm, proud, plain-spoken; about ownership, the neighbourhood and what the turbine does for it. Speak about 'our turbine'.",
  college: "College and university students. Precise, technical and confident: direct drive, power curve, tip speed, variability, open data. No exclamation marks.",
};

const CHAPTER_BRIEFS = {
  hello: "The opening: who the turbine is. Shown over a wide 3D shot.",
  now: "Right now: shown over a live view of the real place. Write 'working' variants (the turbine is generating) and 'calm' variants (too little wind to generate); never mention spinning or power in the calm ones.",
  walk: "Go inside: the start of a walk from the tower door up the ladders to the machine room. An invitation to come along.",
  ask: "The end: invite people to scan the QR code on screen and ask Ace a question on their phone. Mention that the chat is private or that it's free, at most.",
};

// Where a screen tells a chapter its own way (see frontend/src/content/screens.js).
const SCREEN_CHAPTER_BRIEFS = {
  students: {
    now: "Right now: shown over the 3D turbine beside a race of Ace's live blade-tip speed against fast things. Write 'working' variants (the turbine is generating) and 'calm' variants (too little wind to generate); never mention spinning or power in the calm ones.",
    walk: "My story: the start of a climb up inside the tower; on the way up the screen tells how Ace was built, from the first idea to switching on. A short, simple invitation to climb through Ace's story; keep every part well under its limit. Give no dates or build details: they're shown on the way.",
  },
};

export function storyPrompt(audience) {
  const placeholders = Object.entries(STORY_PLACEHOLDERS).map(([k, v]) => `{${k}}: ${v}`).join("\n");
  const shape = GENERATED_CHAPTERS.map((id) =>
    id === "now" ? `"now": { "working": [${VARIANTS} variants], "calm": [${VARIANTS} variants] }` : `"${id}": [${VARIANTS} variants]`
  ).join(",\n  ");
  return [
    {
      role: "system",
      content: `You write the captions for a big public screen beside a community wind turbine. Children read it.

${FACTS}
- ${SCREEN_SHOWS[audience]}

Audience: ${VOICES[audience]}

Each caption is { "eyebrow": ..., "line": ..., "sub": ... }:
- eyebrow: a short label, at most ${STORY_LIMITS.eyebrow} characters.
- line: the headline, at most ${STORY_LIMITS.line} characters.
- sub: one supporting sentence, at most ${STORY_LIMITS.sub} characters.

Rules:
- NEVER write a digit. For any figure, use one of these placeholders exactly; the screen fills them in live:
${placeholders}
- Write "carbon dioxide", never the chemical formula. No emoji, no links, no markdown, no hashtags.
- Use only the facts above; invent nothing. British English. Each variant must say something different.
- Never say where something is on the screen (above, below, beside, left, right): the layout changes.

Chapters:
${GENERATED_CHAPTERS.map((id) => `- ${id}: ${SCREEN_CHAPTER_BRIEFS[audience]?.[id] ?? CHAPTER_BRIEFS[id]}`).join("\n")}

Reply with JSON only, no prose, in exactly this shape:
{
  ${shape}
}`,
    },
    { role: "user", content: `Write fresh captions for the ${audience} screen.` },
  ];
}

/** The model's reply as checked chapters, or throws with the reason it was rejected. */
export function parseStory(text) {
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const data = JSON.parse(json);
  const out = {};
  for (const id of GENERATED_CHAPTERS) {
    const groups = id === "now" ? { working: data.now?.working, calm: data.now?.calm } : { list: data[id] };
    for (const [name, list] of Object.entries(groups)) {
      if (!Array.isArray(list) || list.length < 1) throw new Error(`${id}${name === "list" ? "" : `.${name}`} is missing`);
      // A caption that is merely too long is dropped; anything else wrong (a figure written
      // out, markup, an unknown placeholder) means the batch can't be trusted at all.
      groups[name] = list.filter((v) => {
        const problem = storyProblem(v);
        if (problem && !problem.endsWith("too long")) throw new Error(`${id}: ${problem}`);
        return !problem;
      });
      if (!groups[name].length) throw new Error(`${id}: every variant was too long`);
    }
    const clean = (list) => list.map(({ eyebrow, line, sub }) => ({ eyebrow: eyebrow.trim(), line: line.trim(), sub: sub.trim() }));
    out[id] = id === "now" ? { working: clean(groups.working), calm: clean(groups.calm) } : clean(groups.list);
  }
  return out;
}

export async function writeStories() {
  if (!llmEnabled) return;
  const screens = {};
  for (const audience of STORY_AUDIENCES) {
    try {
      const text = await completeChat({ messages: storyPrompt(audience) });
      screens[audience] = parseStory(text);
    } catch (err) {
      log.warn("story words rejected; the screen keeps its own", { audience, err: err.message });
    }
  }
  if (!Object.keys(screens).length) return;
  // Keep earlier words for any audience whose new batch was rejected.
  const previous = JSON.parse((await redis.get(STORIES_KEY).catch(() => null)) ?? "null");
  const merged = { ...(previous?.screens ?? {}), ...screens };
  await redis.set(STORIES_KEY, JSON.stringify({ writtenAt: new Date().toISOString(), screens: merged }), "EX", 24 * 3600);
  log.info("story words written", { audiences: Object.keys(screens) });
}
