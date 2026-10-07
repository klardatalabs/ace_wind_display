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
};
