// Phone chat copy per screen: greeting, suggested questions and big-screen remote buttons.

export const ASK = {
  students: {
    title: "Ask Ace",
    greeting: "Hi! I'm Ace, the giant wind turbine on the hill. Ask me anything — how fast I spin, what's inside me, or what happens in a storm! 🌬️",
    suggestions: ["How fast are your blades going?", "What's inside you?", "How many homes are you powering?", "What happens in a storm?", "Are you taller than Big Ben?"],
  },
  community: {
    title: "Ask Ace",
    greeting: "Hello! I'm Ace, Lawrence Weston's community wind turbine. Ask me how much power I'm making, where the money goes, or anything else about me.",
    suggestions: ["How many homes are you powering right now?", "Who owns this turbine?", "Where does the money go?", "How much carbon did you save today?", "What was your best day ever?"],
  },
  college: {
    title: "Query Ace",
    greeting: "Ace here — Enercon E-115 EP3, 4.2 MW, direct drive. Ask about live telemetry, history, the power curve, or how the drivetrain works.",
    suggestions: ["What's my capacity factor this week?", "Explain the power curve", "Why is there no gearbox?", "Compare today with yesterday", "How is the open data licensed?"],
  },
};

ASK.story = {
  title: "Ask Ace",
  greeting: "Follow the energy from the blades to the shared grid. Ask about any part of the journey.",
  suggestions: ["Why is there no gearbox?", "What does the converter at the tower base do?", "How many homes' worth of power are you making?"],
};

export const REMOTE_ACTIONS = [
  { action: "walk_start", label: "Walk inside", icon: "walk" },
  { action: "look_inside", label: "Look inside", icon: "eye" },
  { action: "tower_inside", label: "Inside the tower", icon: "layers" },
  { action: "spin_blades", label: "Spin the blades", icon: "fan" },
  { action: "fly_to_nacelle", label: "Fly to the top", icon: "arrowRight" },
  { action: "overview", label: "Zoom out", icon: "globe" },
  { action: "close_inside", label: "Close it up", icon: "cube" },
];
