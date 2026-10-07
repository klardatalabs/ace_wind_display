// Copy for the landing page. Numbers shown live come from the turbine; everything else
// here is plain text so it can be edited without touching components.

export const HERO = {
  eyebrow: "Live from Lawrence Weston, Bristol",
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
  { key: "generator", icon: "microchip", title: "Generator hums", body: "No gearbox: the hub turns a giant ring of magnets past copper coils." },
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
    blurb: "Our street-by-street story: homes powered, carbon saved, money that stays local.",
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
    key: "ask",
    title: "Ask Ace",
    to: "/ask/community",
    icon: "commentDots",
    blurb: "Scan the QR on any screen and chat with the turbine. Private to your phone.",
    image: "renderNacelle",
  },
  {
    key: "developers",
    title: "Developers",
    to: "/developers",
    icon: "code",
    blurb: "Open data, a live WebSocket and REST endpoints — build on it.",
    image: "tall",
  },
];

export const DAY_IN_LIFE = [
  {
    when: "06:10 · Dawn",
    title: "Waking up with the tide",
    image: "dawn",
    body: "The first breeze off the estuary nudges my blades past cut-in speed. Kettles are going on across the estate.",
    chat: [
      { who: "Ace", text: "Morning! Wind's at 4.1 m/s and climbing — I've just started making power ☀️" },
      { who: "Visitor", text: "How many homes is that?" },
      { who: "Ace", text: "Right now, about 540. By breakfast it should be over a thousand." },
    ],
  },
  {
    when: "08:45 · School run",
    title: "Thirty kids, one question",
    body: "A class scans the QR on the Students screen. Everyone wants to know the same thing.",
    chat: [
      { who: "Visitor", text: "how fast are your blades going??" },
      { who: "Ace", text: "My tips are moving at about 140 mph — faster than a train on the main line! 🚄" },
      { who: "Ace", text: "Look up at the big screen — I'm opening up so you can see inside." },
    ],
  },
  {
    when: "13:00 · Midday gusts",
    title: "Running flat out",
    body: "A front comes through. I turn to face it, pitch my blades and hit full power.",
    chat: [
      { who: "Visitor", text: "What's my capacity factor this week?" },
      { who: "Ace", text: "Checking my history… I'll pull the last seven days from the database and show the power curve on the College screen." },
    ],
  },
  {
    when: "18:30 · Evening peak",
    title: "When it matters most",
    image: "dusk",
    body: "Ovens on, heating up, lights on. Every kilowatt-hour here is one that didn't come from gas.",
    chat: [
      { who: "Visitor", text: "where does the money go?" },
      { who: "Ace", text: "Income from my electricity supports Ambition Lawrence Weston's work on fuel poverty and the community." },
    ],
  },
  {
    when: "23:00 · Night",
    title: "Still turning in the dark",
    body: "My red aviation light blinks over the estuary. The wind doesn't clock off, and neither do I.",
    chat: [
      { who: "Visitor", text: "do you ever stop?" },
      { who: "Ace", text: "Only below about 2.5 m/s, for maintenance, or above ~34 m/s to protect myself in a storm." },
    ],
  },
];

export const QUESTION_WALL = [
  { q: "How many homes are you powering", hl: "right now", end: "?" },
  { q: "What's", hl: "inside", end: " the nacelle?" },
  { q: "Who", hl: "owns", end: " this turbine?" },
  { q: "How fast are your", hl: "blade tips", end: "?" },
  { q: "What was your", hl: "best day", end: " ever?" },
  { q: "Why is there", hl: "no gearbox", end: "?" },
  { q: "How much", hl: "carbon", end: " did you save today?" },
  { q: "What happens in a", hl: "storm", end: "?" },
  { q: "Can I", hl: "download", end: " your data?" },
  { q: "How", hl: "tall", end: " are you compared to Big Ben?" },
  { q: "What's a", hl: "capacity factor", end: "?" },
  { q: "Do you", hl: "turn", end: " to face the wind?" },
];
