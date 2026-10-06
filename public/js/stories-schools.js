// Story bank for the Schools (kid-friendly) persona.
// Short, super-catchy headlines with fun comparisons (cheetahs, football pitches, game consoles).

import { pickVariant } from "./story-rotator.js";

const fmtInt = (n) => Math.round(n).toLocaleString();
const fmt1 = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export function moodStory(mood) {
  const byMood = {
    storm: {
      badge: "WHOA! GALE ALERT!",
      icon: "🌪️",
      stat: "Storm Shield",
      statUnit: "blades feathered sideways!",
      headline: "Hold Onto Your Hats!",
      lead: "Whoa, it's super windy out there! I'm turning my giant blades sideways so the storm can't knock me about. Safety first!",
    },
    fault: {
      badge: "QUICK PIT STOP",
      icon: "🩹",
      stat: "Resting",
      statUnit: "engineers taking a peek",
      headline: "Time for a Quick Breather",
      lead: "Ouch! Something felt a bit squeaky, so I paused for a second. My superhero engineer friends are on their way to check on me!",
    },
    maintenance: {
      badge: "CHECK-UP TIME",
      icon: "👷",
      stat: "Hi-Vis Team",
      statUnit: "friendly technicians visiting",
      headline: "Having My Check-Up!",
      lead: "My friendly crew in bright hi-vis jackets are up in my tower right now giving me a health check-up. Say hello!",
    },
    curtailed: {
      badge: "SHARING IS CARING",
      icon: "⚡",
      stat: "Taking It Easy",
      statUnit: "grid has plenty of power",
      headline: "Sharing the Bristol Grid!",
      lead: "There's tons of wind today, but National Grid asked me to slow down a tiny bit because the power lines are already chock-full!",
    },
    calm: {
      badge: "SHH... NAP TIME!",
      icon: "😴",
      stat: "Zzz...",
      statUnit: "waiting for wind above 2.5 m/s",
      headline: "Catching 40 Winks!",
      lead: "Shh... the air is super calm in Lawrence Weston today. I'm having a cozy nap until the breeze wakes my blades back up!",
    },
    starting: {
      badge: "WAKING UP!",
      icon: "🌅",
      stat: "Stretching",
      statUnit: "here comes the breeze!",
      headline: "Ooh, I Feel a Breeze!",
      lead: "Yaaaaawn! I feel the coastal breeze tickling my tips! Here I go, getting ready to make fresh clean electricity!",
    },
  };

  const item = byMood[mood];
  if (!item) return null;
  return item;
}

export function powerStory(powerKw, homes) {
  const kettles = Math.round(powerKw / 2.2);
  const consoles = Math.round(powerKw * 10);
  const templates = [
    {
      headline: "Wheee! Look at Me Go!",
      lead: `I'm spinning out ${fmtInt(powerKw)} kilowatts of pure green energy right now — powering about ${fmtInt(homes)} houses in our neighborhood!`,
      stat: `${fmtInt(homes)} Houses`,
      statUnit: `powered right now (${fmtInt(powerKw)} kW)`,
    },
    {
      headline: "Powering Gamer Mode!",
      lead: `The electricity I'm making this very second is enough to power over ${fmtInt(consoles)} game consoles all playing at the same time!`,
      stat: `${fmtInt(consoles)} Consoles`,
      statUnit: "running on clean wind energy!",
    },
    {
      headline: "Boiling Giant Kettles!",
      lead: `I'm pumping out enough electrical power right now to boil ${fmtInt(kettles)} kitchen kettles all at once! That's a lot of hot chocolate!`,
      stat: `${fmtInt(kettles)} Kettles`,
      statUnit: "of boiling water at once!",
    },
  ];
  const chosen = pickVariant(templates, "schools-power");
  return {
    badge: "SUPER POWER!",
    icon: "⚡",
    headline: chosen.headline,
    lead: chosen.lead,
    stat: chosen.stat,
    statUnit: chosen.statUnit,
  };
}

export function tipSpeedStory(mph) {
  const cheetahMph = 70;
  const ratio = (mph / cheetahMph).toFixed(1);
  const lead = mph > cheetahMph
    ? `The tips of my blades are zooming at ${fmtInt(mph)} mph! That is over ${ratio} times faster than the fastest cheetah sprinting on Earth!`
    : `My blade tips are slicing through the clouds at ${fmtInt(mph)} miles per hour! Zoom!`;

  return {
    badge: "FASTER THAN A CHEETAH!",
    icon: "🐆",
    headline: "Speed Demon in the Sky!",
    lead,
    stat: `${fmtInt(mph)} mph`,
    statUnit: `blade-tip speed (Cheetah = ~70 mph)`,
  };
}

export function sweepStory() {
  return {
    badge: "COLOSSAL SIZE!",
    icon: "⚽",
    headline: "Bigger Than 1.5 Football Pitches!",
    lead: "Every single time my three giant blades spin around once, they sweep through an area bigger than one and a half Premier League football pitches!",
    stat: "10,514 m²",
    statUnit: "sky swept on every single turn!",
  };
}

export function heightStory() {
  return {
    badge: "GIANT HEIGHT!",
    icon: "🎡",
    headline: "Taller Than the London Eye!",
    lead: "My hub is 150 meters tall and my tip reaches 208 meters! That makes me taller than the London Eye (135m) and twice as tall as Big Ben!",
    stat: "208 Metres",
    statUnit: "tip height (England's tallest!)",
  };
}

export function cleanAirStory(co2Kg, trees) {
  return {
    badge: "EARTH HERO!",
    icon: "🌍",
    headline: "Fighting Climate Change!",
    lead: `By making clean wind energy today, we stopped ${fmtInt(co2Kg)} kg of yucky smoke from entering the air — just like planting ${fmtInt(trees)} leafy trees!`,
    stat: `${fmtInt(trees)} Trees`,
    statUnit: `of clean air power saved today!`,
  };
}

export function howItWorksStory() {
  return {
    badge: "HOW IT WORKS!",
    icon: "💡",
    headline: "Magic Behind the Spin!",
    lead: "The wind pushes my aerodynamic wings, turning a giant circular magnet generator in my head — ta-da, direct electricity with no noisy gearbox!",
    stat: "100% Green",
    statUnit: "no coal, no oil, zero pollution!",
  };
}
