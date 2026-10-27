// Copy for the landing page. Numbers shown live come from the turbine; everything else
// here is plain text so it can be edited without touching components.

export const HERO = {
  eyebrow: "Community-owned wind · Lawrence Weston, Bristol",
  titleStart: "Clean power our neighbourhood",
  titleEmphasis: "actually owns",
  titleEnd: ".",
  body: "England's tallest onshore wind turbine belongs to the people who live beneath it. Watch it work, look inside it, and ask it anything.",
  note: "No app, no login — scan a screen and chat.",
  slides: ["Wind", "Turbine", "Grid", "Homes"],
};

export const LOOP_STEPS = [
  { key: "wind", icon: "wind", title: "Wind arrives", body: "Air rolling in off the Severn Estuary pushes on three 56-metre blades." },
  { key: "blades", icon: "fan", title: "Blades turn", body: "Lift spins the rotor — slowly, but the blade tips can pass 150 mph." },
  { key: "generator", icon: "microchip", title: "Generator hums", body: "No gearbox: the hub turns a giant ring of electromagnets past copper coils." },
  { key: "grid", icon: "plug", title: "Grid carries it", body: "A converter and transformer tidy the power up and send it into the grid." },
  { key: "homes", icon: "home", title: "Homes light up", body: "Clean electricity reaches homes — and the income stays in Lawrence Weston." },
];

export const SCREEN_CARDS = [
  {
    key: "students",
    title: "Students",
    to: "/screen/students",
    icon: "child",
    blurb: "Big numbers, giant comparisons and a turbine that opens up like a toy.",
    image: "renderHero",
  },
  {
    key: "community",
    title: "Community",
    to: "/screen/community",
    icon: "heart",
    blurb: "Our street-by-street story: turbine power, the people who own it, and where the income goes.",
    image: "drone",
  },
  {
    key: "college",
    title: "College",
    to: "/screen/college",
    icon: "graduation",
    blurb: "Power curves, live telemetry and a cutaway of the direct-drive generator.",
    image: "renderInside",
  },
  {
    key: "site",
    title: "Live visualisation",
    to: "/screen/live",
    icon: "cube",
    blurb: "A full-screen 3D explorer. Move around ACE, select its parts, and explore inside the tower and machine room.",
    image: "liveVisualisation",
  },
];

export const DAY_IN_LIFE = [
  {
    when: "06:10 · Dawn",
    image: "dawn",
    focus: "50% 45%", // object-position that keeps the turbine in frame
    title: "Waking up with the tide",
    body: "The first breeze off the estuary nudges my blades past cut-in speed. Kettles are going on across the estate.",
  },
  {
    when: "08:45 · School run",
    image: "hillside",
    focus: "70% 42%", // object-position that keeps the turbine in frame
    title: "Thirty kids, one question",
    body: "A class scans the QR on the Students screen. Everyone wants to know the same thing.",
  },
  {
    when: "13:00 · Midday gusts",
    image: "portrait",
    focus: "50% 12%", // object-position that keeps the turbine in frame
    title: "Running flat out",
    body: "A front comes through. I turn to face it, pitch my blades and hit full power.",
  },
  {
    when: "18:30 · Evening peak",
    image: "drone",
    focus: "30% 35%", // object-position that keeps the turbine in frame
    title: "When it matters most",
    body: "Ovens on, heating up, lights on. This imagined evening shows how demand changes across the day.",
  },
  {
    when: "23:00 · Night",
    image: "dusk",
    focus: "50% 50%", // object-position that keeps the turbine in frame
    title: "Still turning in the dark",
    body: "My red aviation light blinks over the estuary. The wind doesn't clock off, and neither do I.",
  },
];

export const QUESTION_WALL = [
  { q: "How many homes are you powering", hl: "right now", end: "?" },
  { q: "What's", hl: "inside", end: " the nacelle?" },
  { q: "Who", hl: "owns", end: " this turbine?" },
  { q: "How fast are your", hl: "blade tips", end: "?" },
  { q: "What was your", hl: "best day", end: " ever?" },
  { q: "Why is there", hl: "no gearbox", end: "?" },
  { q: "How much", hl: "energy", end: " did you generate today?" },
  { q: "What happens in a", hl: "storm", end: "?" },
  { q: "Can I", hl: "download", end: " your data?" },
  { q: "How", hl: "tall", end: " are you compared to Big Ben?" },
  { q: "What's a", hl: "capacity factor", end: "?" },
  { q: "Do you", hl: "turn", end: " to face the wind?" },
  { q: "How much", hl: "money", end: " goes back to the community?" },
  { q: "What happens when there's", hl: "no wind", end: "?" },
  { q: "What's the", hl: "red light", end: " on top for?" },
  { q: "Are you", hl: "noisy", end: " up close?" },
  { q: "How", hl: "old", end: " are you?" },
  { q: "Who", hl: "built", end: " you?" },
  { q: "How heavy are your", hl: "blades", end: "?" },
  { q: "How does the", hl: "generator", end: " work?" },
  { q: "How much did you make", hl: "this week", end: "?" },
  { q: "Can I", hl: "visit", end: " the turbine?" },
  { q: "Do birds", hl: "fly", end: " into the blades?" },
  { q: "Where does your", hl: "electricity", end: " go?" },
];
