// What you can tap in the scene, and what it says. `resolveHotspot()` turns a ray hit into
// an id; HOTSPOTS holds the card for each id. Descriptions are short and general-purpose
// engineering / local-knowledge text; the card's "Ask Ace more" button fetches a fuller,
// sourced answer through the chatbot's web search. Places shown as illustrations (the
// estate, units, solar farm, pylons) are labelled as such rather than passed off as surveyed.

import { msToMph, tipSpeedMs } from "@shared/impact.js";
import { shoreX } from "./world/noise.js";
import { distToPolyline, ROAD, TRACK, landCoverAt, LC, ZONES, inZone } from "./world/layout.js";

const fmt = (n, d = 0) => (Number.isFinite(n) ? n.toLocaleString("en-GB", { maximumFractionDigits: d, minimumFractionDigits: d }) : "—");

/** @typedef {{ title: string, kicker: string, text: string, facts?: (ctx: object) => Array<[string, string]>, ask: string, illustration?: boolean }} Hotspot */

/** @type {Record<string, Hotspot>} */
export const HOTSPOTS = {
  // ------------------------------------------------------------ the turbine
  blade: {
    kicker: "The turbine",
    title: "Rotor blade",
    text: "Three blades turn the wind into rotation. Each is about 56 m long and made of glass-fibre composite. The blades can twist (pitch) to catch more wind in a breeze, or to spill it in a storm so the turbine stays safe.",
    facts: ({ live }) => [
      ["Length", "≈ 56 m"],
      ["Rotor speed now", `${fmt(live.rpm, 1)} rpm`],
      ["Tip speed now", `${fmt(msToMph(tipSpeedMs(live.rpm)))} mph`],
    ],
    ask: "How are the blades of this wind turbine made, and how do they pitch?",
  },
  hub: {
    kicker: "The turbine",
    title: "Hub and spinner",
    text: "The three blades bolt onto the hub. Inside it, motors turn each blade to the right angle. The smooth nose cone, the spinner, guides the air around the hub.",
    facts: ({ live }) => [["Turns at", `${fmt(live.rpm, 1)} rpm`], ["Blades", "3"]],
    ask: "What is inside the hub of a wind turbine and how does blade pitch control work?",
  },
  nacelle: {
    kicker: "The turbine",
    title: "Nacelle",
    text: "The machine house on top of the tower. It holds the generator, the bearings, the control cabinets and the yaw drives that turn the whole thing to face the wind. Use “Look inside” to see it open.",
    facts: ({ live }) => [["Facing", `${fmt(live.nacelleDeg)}°`], ["Gearbox", "none (direct drive)"]],
    ask: "What is inside the nacelle of the Enercon E-115 turbine at Lawrence Weston?",
  },
  machinery: {
    kicker: "Inside the nacelle",
    title: "Machine room",
    text: "Control cabinets, the yaw drives and the generator all live here, in a space about the size of a small flat, 90 m up.",
    ask: "What equipment is inside the nacelle of a direct-drive wind turbine?",
  },
  generator: {
    kicker: "Inside the nacelle",
    title: "Ring generator",
    text: "There is no gearbox. The hub spins the generator directly: a big ring whose rotating part makes a magnetic field that sweeps past copper windings and pushes electricity along them. Fewer moving parts means less to wear out.",
    facts: ({ live }) => [["Power now", `${fmt(live.powerKw)} kW`], ["Rated power", "4.2 MW"]],
    ask: "How does the annular ring generator in an Enercon direct-drive turbine work?",
  },
  tower: {
    kicker: "The turbine",
    title: "Tower",
    text: "A hollow tower about 89 m tall lifts the rotor into stronger, smoother wind. It is painted in Enercon's signature green, fading from dark at the base to light higher up. Inside are a ladder, a small service lift and the cables that carry the power down.",
    facts: () => [["Height to nacelle", "≈ 89 m"], ["To blade tip", "150 m"]],
    ask: "How tall is the Lawrence Weston wind turbine and what is its tower made of?",
  },
  door: {
    kicker: "The turbine",
    title: "Tower door",
    text: "Engineers go in here. Inside there is a ladder up the wall and a small service lift, for the long climb to the nacelle.",
    ask: "How do technicians get up inside a wind turbine tower?",
  },
  foundation: {
    kicker: "The turbine",
    title: "Foundation",
    text: "A huge steel-reinforced concrete base spreads the load into the ground and keeps 150 m of turbine upright in the wind. Most of it is buried; only the top is visible.",
    ask: "How big and deep is the foundation of a large onshore wind turbine?",
  },
  transformer: {
    kicker: "The turbine",
    title: "Transformer station",
    text: "Raises the voltage of the electricity so it can travel through the local grid with little loss, then hands it over to the network.",
    ask: "What does the transformer at the base of a wind turbine do?",
  },
  light: {
    kicker: "The turbine",
    title: "Aviation light",
    text: "A red light that blinks on top of the nacelle so aircraft can see the turbine, day and night.",
    ask: "Why do wind turbines have red aviation lights?",
  },
  sensors: {
    kicker: "The turbine",
    title: "Wind sensors",
    text: "Anemometers and a wind vane measure how fast the wind blows and where it comes from. The turbine uses them to turn into the wind and to decide when to start, slow down or stop.",
    facts: ({ live }) => [["Wind now", `${fmt(live.windMs, 1)} m/s`], ["From", `${fmt(live.windDeg)}°`]],
    ask: "How do the wind sensors on a wind turbine work?",
  },
  neighbour: {
    kicker: "Nearby",
    title: "A second turbine",
    text: "Another, smaller wind turbine stands near this one, and you can see how much taller the community turbine is by comparison.",
    ask: "Are there other wind turbines near Avonmouth and Lawrence Weston in Bristol?",
  },

  // ------------------------------------------------------------ inside the turbine
  ladder: {
    kicker: "Inside the tower",
    title: "Ladder",
    text: "Engineers climb this ladder, about 90 m, to reach the nacelle, resting on platforms on the way up.",
    ask: "How do wind turbine technicians climb the tower and what safety gear do they use?",
  },
  lift: {
    kicker: "Inside the tower",
    title: "Service lift",
    text: "A small lift carries one or two people and their tools up the tower, saving a very long climb.",
    ask: "Do wind turbine towers have lifts?",
  },
  platform: {
    kicker: "Inside the tower",
    title: "Platform",
    text: "Landings with a hatch where the ladder passes through. They give climbers a place to rest and make the tower stiffer.",
    ask: "Why do wind turbine towers have platforms inside?",
  },
  cabinet: {
    kicker: "Inside the turbine",
    title: "Control and converter cabinets",
    text: "The turbine's brain and its power electronics. The converter matches the electricity to the grid's 50 Hz, whatever speed the rotor happens to be turning.",
    ask: "What does the converter do in a variable-speed wind turbine?",
  },
  cable: {
    kicker: "Inside the tower",
    title: "Power cables",
    text: "Heavy cables hang in a loop from the nacelle down to the base. The loop lets the nacelle turn to face the wind without snapping them.",
    ask: "Why do wind turbine power cables hang in a loop in the tower?",
  },
  yaw: {
    kicker: "Inside the nacelle",
    title: "Yaw drives",
    text: "Electric motors with gears on a toothed ring at the top of the tower. They turn the whole nacelle, slowly and precisely, to face the wind.",
    facts: ({ live }) => [["Nacelle facing", `${fmt(live.nacelleDeg)}°`]],
    ask: "How does a wind turbine yaw system turn the nacelle into the wind?",
  },
  stator: {
    kicker: "Inside the nacelle",
    title: "Copper coils (stator)",
    text: "A ring of copper coils. As the generator's rotor spins past them, electricity is induced in the copper.",
    ask: "What are the stator windings in a wind turbine generator?",
  },
  mainshaft: {
    kicker: "Inside the nacelle",
    title: "Main bearing and shaft",
    text: "Carries the weight of the rotor and lets it turn smoothly, connecting the hub straight to the generator.",
    ask: "What does the main bearing do in a direct-drive wind turbine?",
  },
  fans: {
    kicker: "Inside the nacelle",
    title: "Cooling fans",
    text: "The generator and electronics get hot at full power. Fans move air through the nacelle to keep everything at a safe temperature.",
    ask: "How is a wind turbine generator cooled?",
  },

  // ------------------------------------------------------------ the place
  estuary: {
    kicker: "The place",
    title: "Severn Estuary",
    text: "The turbine stands beside one of the biggest tidal ranges in the world: the water can rise and fall by around 14 metres between tides. The estuary also funnels wind, which is part of why this is a good place for a turbine.",
    ask: "How big is the tidal range of the Severn Estuary and why is it so large?",
  },
  mudflats: {
    kicker: "The place",
    title: "Mud flats",
    text: "When the tide goes out, wide flats of mud and sand are uncovered. They are a rich feeding ground for wading birds.",
    ask: "Why are the Severn Estuary mudflats important for birds?",
  },
  seawall: {
    kicker: "The place",
    title: "Sea wall",
    text: "A grassy bank that keeps the high tides out of the low-lying land behind it, where the turbine, the roads and the fields are.",
    ask: "What flood defences protect Avonmouth and Lawrence Weston from the Severn Estuary?",
  },
  bridge: {
    kicker: "The place",
    title: "The Severn crossing",
    text: "On clear days the long bridge carrying the M4 across the estuary to Wales can be seen from this stretch of coast. It is shown here as a distant silhouette.",
    illustration: true,
    ask: "What is the Prince of Wales Bridge (Second Severn Crossing) and when did it open?",
  },
  hills: {
    kicker: "The place",
    title: "Distant hills",
    text: "Layers of hills on the far horizon, softened by haze. Distant things look paler and bluer because of the air between you and them.",
    illustration: true,
    ask: "What hills can be seen across the Severn Estuary from Bristol?",
  },
  woodland: {
    kicker: "The place",
    title: "Trees and woodland",
    text: "Turbines are sited away from woods: trees break up the wind into gusty, turbulent air that is bad for energy and for the machine. Open fields and the coast are much better.",
    ask: "Why are wind turbines not built close to woods?",
  },
  estate: {
    kicker: "The community",
    title: "Housing estate",
    text: "Homes like these are what the turbine is for. The clean electricity it makes is enough for thousands of homes, and the income supports the neighbourhood. In the evening, the windows light up in proportion to how much the turbine is generating.",
    facts: ({ live }) => [["Homes powered now", fmt(live.homes)]],
    illustration: true,
    ask: "What is Lawrence Weston in Bristol and how does the community turbine benefit local people?",
  },
  industrial: {
    kicker: "The place",
    title: "Industrial units",
    text: "Avonmouth is one of Bristol's main industrial and port areas, full of warehouses, depots and docks. It is a big user of electricity, which makes local generation valuable.",
    illustration: true,
    ask: "What is Avonmouth in Bristol known for?",
  },
  chimney: {
    kicker: "The place",
    title: "Chimney stack",
    text: "A tall industrial chimney. The red and white bands are aircraft-warning paint, like the light on top of the turbine.",
    illustration: true,
    ask: "Why are tall chimneys painted in red and white bands?",
  },
  solar: {
    kicker: "The place",
    title: "Solar farm",
    text: "Rows of solar panels tilted to face the sun. Wind and sun work well together: it is usually windier in winter and sunnier in summer, so each fills in for the other.",
    illustration: true,
    ask: "How do wind and solar power complement each other in the UK?",
  },
  pylons: {
    kicker: "The place",
    title: "Pylons and power lines",
    text: "High-voltage lines carry electricity across the country from where it is made to where it is used.",
    illustration: true,
    ask: "How does electricity get from a wind turbine to people's homes in the UK?",
  },
  road: {
    kicker: "The place",
    title: "Road",
    text: "The turbine's parts, up to 56 m blades, arrived on the back of very long lorries along roads like this one, usually at night to avoid traffic.",
    ask: "How are wind turbine blades transported by road?",
  },
  track: {
    kicker: "The place",
    title: "Access track",
    text: "A gravel track that lets maintenance crews and cranes reach the turbine.",
    ask: "How do engineers maintain an onshore wind turbine?",
  },
  pad: {
    kicker: "The place",
    title: "Crane pad",
    text: "A firm gravel area around the base. A very large crane stands on ground like this to lift the tower sections and blades into place, and again for major repairs.",
    ask: "How is a large onshore wind turbine erected with cranes?",
  },
  pasture: {
    kicker: "The place",
    title: "Pasture",
    text: "Grass fields grazed by animals or cut for hay. Farmland can carry on right up to a turbine's base, so the land keeps working.",
    ask: "Can farmland still be used around a wind turbine?",
  },
  crop: {
    kicker: "The place",
    title: "Crops",
    text: "Arable fields. The wind that turns the turbine also moves the crops, and farmers and turbines share the land comfortably.",
    ask: "How much land does an onshore wind turbine need?",
  },
  field: {
    kicker: "The place",
    title: "Fields and hedgerows",
    text: "A patchwork of fields divided by hedgerows. Hedges are valuable wildlife corridors for birds, insects and small mammals.",
    ask: "Why are hedgerows important for wildlife in the UK?",
  },
  sky: {
    kicker: "Right now",
    title: "The sky over Bristol",
    text: "This is the real sky: the sun is where it really is over Bristol at this moment, and the clouds, rain and haze follow the weather reported at the site.",
    facts: ({ weather, sun, hour }) => {
      const out = [["Time (UK)", hour]];
      if (sun != null) out.push(["Sun height", `${fmt(sun)}°`]);
      if (weather?.tempC != null) out.push(["Temperature", `${fmt(weather.tempC, 1)}°C`]);
      if (weather?.description) out.push(["Weather", weather.description]);
      if (weather?.cloudCover != null) out.push(["Cloud cover", `${fmt(weather.cloudCover * 100)}%`]);
      return out;
    },
    ask: "What is the weather and wind like at Avonmouth, Bristol today?",
  },
};

// Turbine parts by node name (checked in order, so more specific names come first).
const BY_NODE_NAME = [
  [/TowerEntrance/, "door"],
  [/Foundation/, "foundation"],
  [/Transformer/, "transformer"],
  [/Aviation/, "light"],
  [/RoofSensors/, "sensors"],
  [/GeneratorRotor/, "generator"],
  [/NacelleInternals/, "machinery"],
  [/NacelleShell/, "nacelle"],
  [/Blade/, "blade"],
  [/Spinner|ACE_Hub/, "hub"],
  [/Tower/, "tower"],
];

/**
 * Which hotspot a ray hit belongs to.
 * @param {THREE.Intersection} hit
 * @param {{ neighbour?: THREE.Object3D }} ctx
 */
export function resolveHotspot(hit, ctx = {}) {
  for (let o = hit.object; o; o = o.parent) {
    if (o === ctx.neighbour) return "neighbour";
    if (o.userData?.hotspot) {
      if (o.userData.hotspot === "terrain") return terrainHotspot(hit.point);
      return o.userData.hotspot;
    }
    for (const [re, id] of BY_NODE_NAME) if (o.name && re.test(o.name)) return id;
  }
  return null;
}

/** The ground is one mesh, so what you tapped depends on where. */
function terrainHotspot(p) {
  const { x, z } = p;
  if (Math.hypot(x, z) < 33) return "pad";
  if (distToPolyline(TRACK, x, z) < 3.5) return "track";
  if (distToPolyline(ROAD, x, z) < 6) return "road";
  const d = x - shoreX(z);
  if (d < 20) return "mudflats";
  if (d < 62) return "seawall";
  if (inZone("estate", x, z, 20)) return "estate";
  if (inZone("industrial", x, z, 20)) return "industrial";
  if (inZone("solar", x, z, 10)) return "solar";
  const lc = landCoverAt(x, z);
  if (lc.cls === LC.WOOD) return "woodland";
  if (lc.hedge > 0.5) return "field";
  if (lc.cls === LC.CROP || lc.cls === LC.PLOUGH) return "crop";
  return "pasture";
}
