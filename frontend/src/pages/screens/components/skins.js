// Per-theme text / surface styles so copy stays legible over each 3D look.
export const SKINS = {
  cartoon: {
    dark: false,
    text: "text-moss-950",
    muted: "text-moss-900/70",
    accent: "text-moss-600",
    scrim: "bg-gradient-to-r from-moss-25/95 via-moss-25/60 to-transparent",
    scrimBottom: "bg-gradient-to-t from-moss-25/80 to-transparent",
    card: "bg-white/85 ring-1 ring-moss-100 shadow-[0_20px_60px_rgb(10_21_29/0.12)]",
    pillTone: "dark",
  },
  realistic: {
    dark: true,
    text: "text-white",
    muted: "text-white/75",
    accent: "text-moss-200",
    scrim: "bg-gradient-to-r from-moss-950/85 via-moss-950/45 to-transparent",
    scrimBottom: "bg-gradient-to-t from-moss-950/70 to-transparent",
    card: "bg-moss-950/55 ring-1 ring-white/15 backdrop-blur-xl shadow-[0_20px_60px_rgb(10_21_29/0.35)]",
    pillTone: "light",
  },
  blueprint: {
    dark: true,
    text: "text-white",
    muted: "text-moss-100/75",
    accent: "text-moss-300",
    scrim: "bg-gradient-to-r from-moss-950/90 via-moss-950/50 to-transparent",
    scrimBottom: "bg-gradient-to-t from-moss-950/80 to-transparent",
    card: "bg-moss-950/60 ring-1 ring-moss-300/25 backdrop-blur-xl shadow-[0_0_40px_rgb(119_192_154/0.12)]",
    pillTone: "light",
  },
  // College: white text straight on the real scene (with a shadow, for any light), and
  // cards like the students' screen, solid white with dark ink (the card* classes).
  college: {
    dark: true,
    text: "text-white [text-shadow:0_1px_12px_rgb(0_0_0/0.7)]",
    muted: "text-white/85 [text-shadow:0_1px_12px_rgb(0_0_0/0.7)]",
    accent: "text-moss-200 [text-shadow:0_1px_12px_rgb(0_0_0/0.7)]",
    scrim: "bg-gradient-to-r from-black/50 via-black/20 to-transparent",
    scrimBottom: "bg-gradient-to-t from-black/35 to-transparent",
    card: "bg-white/85 ring-1 ring-moss-100 shadow-[0_20px_60px_rgb(10_21_29/0.12)]",
    cardText: "text-moss-950",
    cardMuted: "text-moss-900/70",
    cardAccent: "text-moss-600",
    pillTone: "light",
  },
  // The X-ray's white paper (college's climb inside): dark ink on frosted white.
  paper: {
    dark: false,
    text: "text-moss-950",
    muted: "text-moss-900/75",
    accent: "text-moss-600",
    scrim: "bg-gradient-to-r from-white/85 via-white/40 to-transparent",
    scrimBottom: "bg-gradient-to-t from-white/75 to-transparent",
    card: "bg-white/85 ring-1 ring-moss-100 shadow-[0_20px_60px_rgb(10_21_29/0.12)]",
    pillTone: "dark",
  },
};

/** The skin for what sits inside a card: a skin's card* ink where it has one. */
export function cardSkinOf(skin) {
  if (!skin.cardText) return skin;
  return { ...skin, dark: false, text: skin.cardText, muted: skin.cardMuted, accent: skin.cardAccent };
}
