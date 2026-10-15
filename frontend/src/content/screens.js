// The stories told on the three hoarding screens.
//
// A screen is a list of chapters. Each chapter is one beat of a story: a camera move or
// effect in the 3D place (`stage`, see TurbineScene.applyStage), a short caption that speaks
// to the visitor, and a few live "data tags" that hang off real parts of the scene (the
// blade tip, the nacelle, the homes) instead of sitting in cards. `d` is the live data from
// pages/screens/useScreenData.js.

import { formatInt, compassPoint } from "../lib/format.js";
import { STORY_CHAPTERS } from "@shared/stories.js";
import { STORY_SECONDS } from "../three/storyTimeline.ts";

const mph = (ms) => ms * 2.23694;

/**
 * Live tags. `anchor` is a point on the scene (TurbineScene.anchors); `text` is what it says.
 * Chapters list the tag ids they want on screen.
 */
export const TAGS = {
  wind: { anchor: "windward", label: "Wind", value: (d) => `${mph(d.windSpeed).toFixed(0)} mph`, sub: (d) => `from the ${compassPoint(d.windDir)}` },
  rpm: { anchor: "hub", label: "Rotor", value: (d) => `${d.rotorRpm.toFixed(1)} rpm`, sub: () => "one turn about every 5 s at full speed" },
  tip: { anchor: "rotorTip", label: "Blade tip", value: (d) => `${formatInt(d.tipMph)} mph`, sub: () => "fastest part of the machine" },
  power: { anchor: "nacelle", label: "Making", value: (d) => `${d.power.value} ${d.power.unit}`, sub: (d) => `${Math.round(d.utilisation)}% of its 4.2 MW` },
  yaw: { anchor: "nacelle", label: "Facing", value: (d) => `${compassPoint(d.nacelleDeg)} ${Math.round(d.nacelleDeg)}°`, sub: () => "the nacelle turns to the wind" },
  tower: { anchor: "tower", label: "Tower", value: () => "89 m", sub: () => "a ladder and a service lift inside" },
  transformer: { anchor: "transformer", label: "Transformer", value: () => "to the grid", sub: () => "steps the voltage up" },
  today: { anchor: "base", label: "Today", value: (d) => `${d.today.value} ${d.today.unit}`, sub: (d) => `${formatInt(d.co2Kg)} kg CO₂ avoided` },
  homes: { anchor: "estate", label: "Powering", value: (d) => `${formatInt(d.homes)} homes`, sub: () => "right now" },
  height: { anchor: "dimHeight", label: "Height", value: () => "150 m", sub: () => "to the blade tip" },
  rotor: { anchor: "dimRotor", label: "Rotor", value: () => "115.7 m", sub: () => "swept area ≈ 10,500 m²" },
  bigben: { anchor: "dimBigben", label: "Big Ben", value: () => "96 m", sub: () => "for comparison" },
  tsr: { anchor: "rotorTip", label: "Tip-speed ratio", value: (d) => `λ ${d.tsr.toFixed(1)}`, sub: (d) => `${d.tipMs.toFixed(0)} m/s at the tip` },
  curve: { anchor: "nacelle", label: "Power curve says", value: (d) => `${formatInt(d.theoreticalKw)} kW`, sub: (d) => `measured ${formatInt(d.powerKw)} kW` },
  lifetime: { anchor: "base", label: "Since 2023", value: (d) => `${d.lifetime.value} ${d.lifetime.unit}`, sub: () => "generated in total" },
};

/** What the walk says as you climb (keyed by WALK_STAGES ids in three/walk.js). */
export const WALK_CAPTIONS = {
  approach: { title: "Walk up to the tower", text: "Past the transformer, to a door in the base." },
  door: { title: "Through the door", text: "Hard hats on. The daylight fades behind you." },
  lower: { title: "Up the ladder", text: "Cables hang down the wall beside you. Every few metres, a platform." },
  upper: { title: "Higher and higher", text: "The tower narrows. You can feel it sway a little in the wind." },
  hatch: { title: "Through the hatch", text: "One last ladder to the floor of the machine room." },
  machine: { title: "The machine room", text: "You are 90 m up, inside the nacelle. The ring generator is right in front of you." },
};

// The five chapters every hoarding screen plays, in the same order with the same camera
// moves; each screen speaks them in its own voice (`copy` below):
//   hello   who the turbine is, in the 3D place
//   now     the live, real-world view (the same Google 3D scene as the live visualisation)
//   walk    "Go inside": the shared tour from the door up the tower to the machine room
//   day     a day here in twenty seconds, each hour told from what the turbine really did
//   ask     the invitation to scan the QR code and chat
// The students screen swaps "day" for "town" (who owns the turbine, from ACE's own figures).
const CHAPTERS = {
  hello: { id: "hello", label: "Hello", seconds: 12 },
  now: { id: "now", label: "Right now", seconds: 16, stage: { action: "hero" }, live: true },
  walk: { id: "walk", label: "Go inside", seconds: 50, stage: { action: "walk_start", value: 44 }, walk: true },
  day: { id: "day", label: "A day here", seconds: 24, stage: { action: "overview", lapse: [5, 22, 21] }, day: true },
  ask: { id: "ask", label: "Ask me", seconds: 14, stage: { action: "hero" }, ask: true },
  town: { id: "town", label: "Our town", seconds: 22, stage: { action: "aerial" } },
  // Shashi's energy journey (three/storyRail.js) played once through: wind to a home.
  power: { id: "power", label: "Follow my power", seconds: STORY_SECONDS, stage: { action: "tour" }, tour: true },
};

/**
 * Ace's words for each stop of the energy journey (the beats of three/storyTimeline.ts),
 * after the "Follow the Energy" story screen, in the students' voice.
 */
export const TOUR_BEATS = [
  { eyebrow: "Follow my power", line: "It all starts with the wind pushing my blades.", sub: "The stronger the wind, the more power I can catch, right up to my full {rated}." },
  { eyebrow: "Inside my head", line: "Magnets whizz past copper coils. Zap!", sub: "That makes electricity flow. I don't need a gearbox: my blades turn the generator directly." },
  { eyebrow: "Next stop", line: "Down to the converter at the bottom of my tower.", sub: "It gets my electricity ready for the grid, which beats fifty times every second." },
  { eyebrow: "Going down", line: "Down the cables inside my tower we go.", sub: "Thick power cables hang beside the ladder and the lift, all the way to the ground." },
  { eyebrow: "The transformer", line: "The transformer gives my power a big push.", sub: "It raises the voltage, so electricity can travel a long way without wasting much." },
  { eyebrow: "Along the lines", line: "Now it zooms along the power lines.", sub: "This glow shows the idea of power travelling through the shared grid. It isn't the exact real cable." },
  { eyebrow: "Our streets", line: "Right now I'm making enough for {homes} homes.", sub: "That's how many homes' worth of electricity I'm making this second, not a count of real houses." },
  { eyebrow: "Into a home", line: "From the street into a home.", sub: "Through the fuse box and the wires in the wall to a socket. This home is a made-up example." },
  { eyebrow: "Your game", line: "Low battery? Plug in. Play on!", sub: "A laptop starts charging from the socket. It's a pretend charge, sped up so you can see it." },
];

/**
 * One screen's story: the shared chapters with this screen's tags, extras and words.
 * `copy` holds hand-written variants; the screen shows the next one each time round, mixed
 * with fresh ones from the server when it has them. "now" has separate words for when the
 * turbine is working and when it's becalmed.
 */
const story = (per, ids = STORY_CHAPTERS) => ids.map((id) => ({ ...CHAPTERS[id], ...per[id], stage: { ...CHAPTERS[id].stage, ...per[id]?.stage } }));

export const SCREENS = {
  students: {
    key: "students",
    name: "Students",
    theme: "cartoon",
    askLabel: "Ask Ace anything!",
    askHint: "Point your phone camera here",
    // Ace, a cartoon of the turbine, tells the story in a speech bubble (components/AceMascot.jsx).
    mascot: true,
    // The scene also builds Shashi's energy journey, for the "Follow my power" chapter.
    tour: true,
    // The climb up the tower tells how the turbine was built (content/buildTimeline.js).
    walkTimeline: true,
    chapters: story(
      {
        hello: {
          // The height panel makes the comparisons, so the 3D scene shows Ace alone.
          stage: { action: "hero" },
          panel: "height",
          copy: [
            { eyebrow: "{greeting}!", line: "I'm Ace, the giant on your doorstep.", sub: "I'm taller than Big Ben, and I belong to the people of Lawrence Weston." },
            { eyebrow: "Look up!", line: "Taller than Big Ben. Powered by wind.", sub: "From the ground to the tip of my blade is {tipHeight}. That's about 34 double-decker buses stacked up!" },
            { eyebrow: "Meet Ace", line: "A wind turbine that belongs to a whole town.", sub: "People here made me happen together, and what I earn helps the neighbourhood." },
          ],
        },
        now: {
          // The real-world map is for grown-ups; here the race panel tells the live story,
          // and the screen never has to load the map.
          live: false,
          // The wind itself, streaming into the blades from where it's really blowing.
          stage: { wind: true },
          panel: "race",
          copy: {
            working: [
              { eyebrow: "Zoom!", line: "My blade tips are flying round at {tip}.", sub: "Each blade is {bladeLength} long, about as long as two blue whales nose to tail." },
              { eyebrow: "Feel that wind?", line: "A {wind} wind is spinning me right now.", sub: "See the streaks? That's the wind from the {windFrom}, pushing my blades round." },
              { eyebrow: "Power up!", line: "I'm making {power} of electricity right now.", sub: "That's enough for {homes} homes, right this second. Every turn of my blades counts." },
            ],
            calm: [
              { eyebrow: "Shhh…", line: "No wind right now, so I'm having a rest.", sub: "I need a breeze of about six miles an hour to start turning. I'll be ready when it comes." },
              { eyebrow: "Waiting for wind", line: "Even giants have to wait sometimes.", sub: "My head turns to face the wind, so I'm ready the moment it picks up." },
              { eyebrow: "Quiet day", line: "The air is still, so my blades are still.", sub: "Wind comes and goes. That's why lots of turbines share the job across the country." },
            ],
          },
        },
        walk: {
          label: "My story",
          copy: [
            { eyebrow: "My story", line: "Climb up inside me and I'll tell you my story.", sub: "Every step up the ladder is a step forward in time, from one idea to a giant turbine." },
            { eyebrow: "Time to climb", line: "Each step up is a step through my history.", sub: "We start at the door and finish in my machine room, {hubHeight} up." },
            { eyebrow: "Hard hats on", line: "Let's climb through the years I was built.", sub: "Engineers climb this ladder for real, with a safety harness, and there's a lift too." },
          ],
        },
        town: {
          // The real photos are the scene here; the 3D view softens and rests behind them.
          backdrop: "soft",
          panel: "town",
          copy: [
            { eyebrow: "This town owns me", line: "I belong to everyone in Lawrence Weston.", sub: "Neighbours dreamed me up and made me happen. No shareholders, just the community." },
            { eyebrow: "Our money, our town", line: "When I sell electricity, the town wins.", sub: "The money I make goes back into Lawrence Weston, to help the neighbourhood." },
            { eyebrow: "Opening day", line: "A man in a top hat cut my ribbon!", sub: "A Brunel lookalike opened me. Brunel designed Bristol's Clifton Suspension Bridge." },
          ],
        },
        ask: {
          copy: [
            { eyebrow: "Your turn!", line: "Got a question? Ask me anything!", sub: "Scan the code with a phone. I'll answer, and I might show you pictures too." },
            { eyebrow: "Ask Ace", line: "What do you want to know about me?", sub: "How fast? How tall? What happens in a storm? Scan the code and ask." },
            { eyebrow: "Chat with me", line: "I know my science from real books.", sub: "Scan the code to ask. Nothing you type shows up on this screen." },
          ],
        },
      },
      ["hello", "now", "power", "walk", "town", "ask"]
    ),
  },

  community: {
    key: "community",
    name: "Community",
    theme: "realistic",
    askLabel: "Ask Ace",
    askHint: "Scan with your phone camera. No app, no login.",
    // The real Lawrence Weston scan around the turbine, in place of the generated scenery.
    scan: true,
    chapters: story({
      hello: {
        stage: { action: "aerial" },
        tags: ["homes"],
        viz: "homes",
        copy: [
          { eyebrow: "Lawrence Weston", line: "Our turbine. Our power.", sub: "Set up by residents through Ambition Community Energy. What it earns goes back into the neighbourhood." },
          { eyebrow: "Built by neighbours", line: "The tallest thing in Bristol belongs to us.", sub: "Residents dreamed it, fought for it and own it. At {tipHeight} it's one of England's tallest onshore turbines." },
          { eyebrow: "Our place", line: "This is Lawrence Weston, as the turbine sees it.", sub: "A real scan of our streets, with the turbine standing over them." },
        ],
      },
      now: {
        copy: {
          working: [
            { eyebrow: "Right now", line: "Making {power} of clean electricity.", sub: "A {wind} wind from the {windFrom}. Enough power for {homes} homes, right now." },
            { eyebrow: "Live", line: "Enough for {homes} homes, this very minute.", sub: "That's {share} of full power, from wind blowing in off the Severn." },
            { eyebrow: "On the job", line: "The wind is working for Lawrence Weston.", sub: "Making {power} right now, with the rotor turning at {rpm}." },
          ],
          calm: [
            { eyebrow: "Right now", line: "Resting until the wind picks up.", sub: "Still air today. The turbine turns itself into the wind as soon as there's enough to use." },
            { eyebrow: "A quiet spell", line: "No wind, no power. It'll be back.", sub: "Across the year the wind here does the work. Calm days are part of the deal." },
            { eyebrow: "Waiting", line: "The blades are still, but the job isn't over.", sub: "So far it has made {lifetime} for the area since spring 2023." },
          ],
        },
      },
      walk: {
        copy: [
          { eyebrow: "Step inside", line: "What's up there, high above the estate?", sub: "A ladder, a few platforms, and a machine room the size of a small flat." },
          { eyebrow: "Behind the door", line: "Few people ever see inside. Come and look.", sub: "Up through the tower to the machine room, {hubHeight} above our streets." },
          { eyebrow: "The climb", line: "Engineers make this climb to keep it turning.", sub: "There's a service lift, but the ladder is always there too." },
        ],
      },
      ask: {
        copy: [
          { eyebrow: "Got a question?", line: "Scan to chat with the turbine.", sub: "Your chat stays on your phone. Nothing you type appears on this screen." },
          { eyebrow: "Ask the turbine", line: "Where does the money go? Ask it.", sub: "It knows the live figures, the history and the story of the project." },
          { eyebrow: "Your turbine, your questions", line: "Curious what it made this week?", sub: "Scan the code and ask. No app, no login." },
        ],
      },
    }),
  },

  college: {
    key: "college",
    name: "College",
    // An X-ray look: the drawing office's cyan lines on navy, so the structure shows through.
    theme: "blueprint",
    askLabel: "Query Ace",
    askHint: "Scan to ask about the data, the physics or the engineering",
    chapters: story({
      hello: {
        stage: { action: "overview", annotations: ["height", "rotor"] },
        tags: ["height", "rotor"],
        panel: "spec",
        copy: [
          { eyebrow: "Enercon E-115 EP3", line: "Gearless, direct drive, {rated}.", sub: "Hub at {hubHeight}, tip at {tipHeight}. Cut-in 2.5 m/s, rated 12.5 m/s, storm control above 28 m/s." },
          { eyebrow: "The machine", line: "One rotor, one ring generator, no gearbox.", sub: "Fewer moving parts means less to wear out: the rotor drives the generator directly." },
          { eyebrow: "Structure", line: "A {tipHeight} machine on a concrete-and-steel tower.", sub: "Concrete segments below, steel above. Every metre of height reaches steadier, faster wind." },
        ],
      },
      now: {
        panel: "curve",
        copy: {
          working: [
            { eyebrow: "Power ∝ v³", line: "At {wind} it's producing {power}.", sub: "Wind power rises with the cube of speed, until the controller caps output at {rated}." },
            { eyebrow: "Live telemetry", line: "Running at {share} of rated power.", sub: "Rotor at {rpm}, tips at {tip}. Pitch and speed control keep the blades near their best angle." },
            { eyebrow: "Tip-speed ratio", line: "Blade tips at {tip}, far faster than the wind.", sub: "Variable speed holds the tip-speed ratio near its optimum, so the rotor extracts as much as it can." },
          ],
          calm: [
            { eyebrow: "Below cut-in", line: "Not enough wind to make useful power.", sub: "Under about two and a half metres per second, losses outweigh output, so the rotor idles." },
            { eyebrow: "Idling", line: "The rotor waits for the cut-in speed.", sub: "Yaw drives keep the nacelle facing the wind so it can start the moment it's worth it." },
            { eyebrow: "Variability", line: "Calm air is why the grid needs a mix.", sub: "Wind output varies hour to hour; storage, interconnectors and other generation fill the gaps." },
          ],
        },
      },
      walk: {
        copy: [
          { eyebrow: "Tower and access", line: "Ladder, service lift, cable loop.", sub: "Power cables hang in a loop so the nacelle can yaw. Converters and the transformer sit at the base." },
          { eyebrow: "Field trip", line: "Follow a technician's route to the nacelle.", sub: "Fall-arrest on the ladder, rest platforms on the way, and a hatch into the machine room." },
          { eyebrow: "Inside the tower", line: "The tower is also a cable duct and a lift shaft.", sub: "It carries the full power down to the converter cabinets, {hubHeight} below the hub." },
        ],
      },
      ask: {
        copy: [
          { eyebrow: "Live tools + textbooks", line: "Query Ace about the physics or the data.", sub: "It reads the live telemetry, wind-energy textbooks and the web, and cites what it used." },
          { eyebrow: "Open data", line: "Ask for this week's capacity factor.", sub: "Answers come from the live feed, the SCADA history or the textbooks, never a guess." },
          { eyebrow: "Go deeper", line: "Why is there no gearbox? Ask.", sub: "Scan the code for answers grounded in the engineering." },
        ],
      },
    }),
  },
};

SCREENS.story = {
  key: "story", name: "Follow the Energy", theme: "realistic", rail: true,
  askLabel: "Ask Ace", askHint: "Scan to explore the journey from wind to home",
  chapters: [
    { id: "wind", label: "Wind", seconds: 11, stage: {}, eyebrow: "01 · Avonmouth / Lawrence Weston, Bristol", line: () => "Local wind. Community power.", sub: () => "The blades turn the hub. Pitch helps them catch or spill wind; available wind power rises roughly as P ∝ v³ until rated output." },
    { id: "generator", label: "Generator", seconds: 12, stage: {}, eyebrow: "02 · Motion into electricity", line: () => "Magnets pass copper coils. Current flows.", sub: () => "ACE's ring generator turns at blade speed. Direct drive — no gearbox. Watch the coils glow as the magnets pass." },
    { id: "converter", label: "Converter", seconds: 7, stage: {}, eyebrow: "03 · Getting ready for the grid", line: () => "The next stop is the converter at the tower base.", sub: () => "The full-power converter decouples the variable-speed generator from the 50 Hz grid. First, the electricity travels down these cables." },
    { id: "tower", label: "Tower", seconds: 10, stage: {}, eyebrow: "04 · Follow the cable", line: () => "Down the tower. Into the converter.", sub: () => "Power cables hang beside the ladder and service lift, carrying electricity to the cabinets at the base." },
    { id: "transformer", label: "Transformer", seconds: 10, stage: {}, eyebrow: "05 · Into the network", line: () => "The transformer steps the voltage up.", sub: () => "Higher voltage helps power travel with less loss. From here, the supply joins the shared grid." },
    { id: "cables", label: "Power lines", seconds: 14, stage: {}, eyebrow: "06 · Across Lawrence Weston", line: () => "Follow the glow along the power lines.", sub: () => "The pylons lead us towards the red-roof neighbourhood. This route illustrates the shared network; it is not a surveyed connection to particular homes." },
    { id: "neighbourhood", label: "Our streets", seconds: 12, stage: {}, tags: ["homes"], eyebrow: "07 · Lawrence Weston, Bristol", line: (d) => `Enough power for about ${formatInt(d.homes)} homes right now.`, sub: () => "A live homes-equivalent estimate, not a count of connected houses. Residents set up Ambition Community Energy; the income goes back into the neighbourhood." },
    { id: "home", label: "One home", seconds: 12, stage: {}, eyebrow: "08 · One home in our neighbourhood", line: () => "From the street to your socket.", sub: () => "Follow the illustrative cutaway: consumer unit, wall wiring, socket and charger. This room represents a home; it is not a particular Bristol address." },
    { id: "laptop", label: "Your game", seconds: 12, stage: {}, eyebrow: "09 · A little power, a big adventure", line: () => "Low battery. Plug in. Play on.", sub: () => "From the community turbine to everyday moments: a Bristol gamer's laptop connects to its charger. The battery rises as charging begins — an illustrative animation, not a real charging speed." },
  ],
};

export const SCREEN_KEYS = Object.keys(SCREENS);
