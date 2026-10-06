// Human-first, inspiring community story bank for Lawrence Weston.
// Zero engineering jargon (no kW, kWh, m/s). Everything is translated into
// homes lit up, families helped, trees planted, and community pride.

import { pickVariant } from "./story-rotator.js";

const fmtInt = (n) => Math.round(n).toLocaleString();

export function moodStory(mood) {
  const byMood = {
    storm: {
      badge: "STORM WATCH",
      icon: "🌪️",
      stat: "Staying Safe",
      statUnit: "blades paused until the storm passes",
      headline: "Standing Tall Against the Wild Atlantic Storm",
      lead: "Fierce storm winds are roaring over the Severn Estuary! Our turbine has automatically turned its giant blades sideways to rest safely until the gale calms down.",
      pride: "Built strong to protect our community for decades.",
    },
    fault: {
      badge: "SAFETY CHECK",
      icon: "⚙️",
      stat: "Quick Check",
      statUnit: "engineers alerted to take a look",
      headline: "Taking a Quick Breather",
      lead: "Our turbine has paused for an automated safety diagnostic. Local engineers have already received the call to keep everything running safely.",
      pride: "Safe, responsible community power.",
    },
    maintenance: {
      badge: "COMMUNITY CARE",
      icon: "👷",
      stat: "Crew on Site",
      statUnit: "local technicians up in the tower",
      headline: "Caring for England's Tallest Turbine",
      lead: "Friendly technicians are on-site at the tower today, giving our 150-metre community landmark its regular health check-up.",
      pride: "Local jobs and hands-on community care.",
    },
    curtailed: {
      badge: "SHARING POWER",
      icon: "⚡",
      stat: "Sharing the Grid",
      statUnit: "holding back so power lines stay safe",
      headline: "Sharing Bristol's Power Network",
      lead: "There is plenty of wind today, but National Grid asked us to slow down a little right now because the regional power lines are already completely full!",
      pride: "An essential backbone of clean regional energy.",
    },
    calm: {
      badge: "PEACEFUL SKIES",
      icon: "🌤️",
      stat: "Quiet Rest",
      statUnit: "waiting for the coastal breeze to pick up",
      headline: "Peaceful, Quiet Skies Over Our Homes",
      lead: "A gentle, still afternoon in Lawrence Weston. Our giant blades are resting peacefully until the coastal breeze picks back up.",
      pride: "Ready to spin the moment the breeze returns.",
    },
    starting: {
      badge: "WAKING UP",
      icon: "🍃",
      stat: "Waking Up",
      statUnit: "blades starting to turn",
      headline: "Catching the Fresh Coastal Breeze",
      lead: "The breeze is picking up over Avonmouth! Our blades are beginning to turn, sending fresh green power straight into local homes.",
      pride: "Clean energy flowing into local homes.",
    },
  };

  const item = byMood[mood];
  if (!item) return null;
  return item;
}

export function homesStory(homes) {
  const safeHomes = Math.max(1, Math.round(homes));
  const templates = [
    {
      headline: `Lighting Up ${fmtInt(safeHomes)} Local Homes Right Now`,
      lead: `Every single house in that count is running on 100% clean wind blowing over Lawrence Weston — zero coal, zero gas, and zero big-corporation profits.`,
      stat: `${fmtInt(safeHomes)} Homes`,
      statUnit: `lit up across Lawrence Weston right now`,
    },
    {
      headline: `Powering Our Neighborhood with Clean Wind`,
      lead: `Right this second, the breeze turning our giant blades is making enough clean electricity to power roughly ${fmtInt(safeHomes)} local families' homes.`,
      stat: `${fmtInt(safeHomes)} Homes`,
      statUnit: `running on 100% clean community energy`,
    },
  ];
  const chosen = pickVariant(templates, "homes");
  return {
    badge: "HOMES POWERED",
    icon: "🏡",
    headline: chosen.headline,
    lead: chosen.lead,
    stat: chosen.stat,
    statUnit: chosen.statUnit,
    pride: "100% community-owned by the residents of Lawrence Weston.",
  };
}

export function fuelPovertyStory(fundGbp) {
  const safeFund = Math.max(15, Math.round(fundGbp));
  const vouchers = Math.max(1, Math.round(safeFund / 30));
  const templates = [
    {
      headline: "Helping Local Families Heat Their Homes",
      lead: `Today's wind has already raised an estimated £${fmtInt(safeFund)} directly for the Ambition Lawrence Weston fund — paying for emergency heating vouchers and community warm hubs.`,
      stat: `£${fmtInt(safeFund)} Raised`,
      statUnit: `for local heating vouchers & warm hubs today (est.)`,
    },
    {
      headline: "Every Turn of the Blade Helps Our People",
      lead: `Our turbine was built with one goal: to fight fuel poverty in Lawrence Weston. Surplus money stays right here in our neighborhood to keep local homes warm and dry.`,
      stat: `~${vouchers} Heat Vouchers`,
      statUnit: `unlocked for local families in need today (est.)`,
    },
  ];
  const chosen = pickVariant(templates, "fund");
  return {
    badge: "FIGHTING FUEL POVERTY",
    icon: "🤝",
    headline: chosen.headline,
    lead: chosen.lead,
    stat: chosen.stat,
    statUnit: chosen.statUnit,
    pride: "Profits stay here — funding warm hubs and helping neighbors in need.",
  };
}

export function cleanAirStory(treesCount) {
  const safeTrees = Math.max(25, Math.round(treesCount));
  const templates = [
    {
      headline: "Clean, Healthy Air for Our Children",
      lead: `Turning today's coastal breeze into electricity has kept thousands of pounds of choking smoke out of Bristol's air — exactly like planting a forest of ${fmtInt(safeTrees)} mature trees.`,
      stat: `${fmtInt(safeTrees)} Trees`,
      statUnit: `worth of clean air generated so far today`,
    },
    {
      headline: "Our Giant Forest in the Sky",
      lead: `By harnessing the clean Atlantic breeze, our turbine prevents dirty fossil fuel pollution from ever reaching our neighborhood streets and schools.`,
      stat: `${fmtInt(safeTrees)} Trees`,
      statUnit: `equivalent in clean air for our community today`,
    },
  ];
  const chosen = pickVariant(templates, "clean-air");
  return {
    badge: "CLEAN AIR & HEALTH",
    icon: "🌱",
    headline: chosen.headline,
    lead: chosen.lead,
    stat: chosen.stat,
    statUnit: chosen.statUnit,
    pride: "Zero coal. Zero gas. Pure clean breeze for our children.",
  };
}

export function windMoodStory(beaufort) {
  const templates = [
    {
      headline: `A ${beaufort} Sweeping Across the Severn Estuary`,
      lead: `High up at 150 metres, the natural coastal breeze is sweeping across our blades — turning clean Atlantic air into warm, powered homes.`,
      stat: `${beaufort}`,
      statUnit: `steady coastal wind turning our blades`,
    },
    {
      headline: `Harvesting Nature's Energy on Our Doorstep`,
      lead: `We live right next to one of the windiest coastal channels in the UK. Instead of letting it pass by, our community is capturing that breeze for ourselves.`,
      stat: `${beaufort}`,
      statUnit: `powering our community right now`,
    },
  ];
  const chosen = pickVariant(templates, "wind-mood");
  return {
    badge: "COASTAL BREEZE",
    icon: "🌬️",
    headline: chosen.headline,
    lead: chosen.lead,
    stat: chosen.stat,
    statUnit: chosen.statUnit,
    pride: "Harnessing natural energy right on our doorstep.",
  };
}

export function landmarkPrideStory() {
  const templates = [
    {
      headline: "England's Tallest Wind Turbine Belongs to Us",
      lead: `Standing 150 metres tall in Avonmouth — taller than the London Eye and twice as tall as Big Ben — this English landmark is 100% owned by the residents of Lawrence Weston.`,
      stat: "100% Resident Owned",
      statUnit: "tallest onshore wind turbine in England",
    },
    {
      headline: "A Landmark Built by Our Community",
      lead: `Together, our community proved that everyday residents can build clean, green energy projects that rival giant energy corporations. We own our future.`,
      stat: "Built by Us, for Us",
      statUnit: "a permanent beacon of pride in Lawrence Weston",
    },
  ];
  const chosen = pickVariant(templates, "landmark");
  return {
    badge: "COMMUNITY PRIDE",
    icon: "🏆",
    headline: chosen.headline,
    lead: chosen.lead,
    stat: chosen.stat,
    statUnit: chosen.statUnit,
    pride: "A permanent beacon of community pride in Lawrence Weston.",
  };
}
