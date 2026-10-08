// Overlay while the camera climbs the tower: how high you are and where you are on the climb.

import { WALK_STAGES } from "../../../three/walk.js";
import { WALK_CAPTIONS } from "../../../content/screens.js";

export default function WalkHud({ walk, skin }) {
  if (!walk) return null;
  const stage = WALK_STAGES.find((s) => walk.s >= s.from && walk.s < s.to) ?? WALK_STAGES[WALK_STAGES.length - 1];
  const caption = WALK_CAPTIONS[stage.id];
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className={`absolute top-[14vmin] right-[4vmin] flex items-end gap-[1.2vmin] rounded-[2vmin] px-[2.2vmin] py-[1.4vmin] ${skin.card}`}>
        <span className={`font-display text-[clamp(32px,7vmin,140px)] leading-none font-bold tabular-nums ${skin.text}`}>{Math.max(0, Math.round(walk.height))}</span>
        <span className={`pb-[0.6vmin] text-[clamp(14px,2.4vmin,48px)] ${skin.accent}`}>m up</span>
      </div>
      <div className="absolute top-[26vmin] right-[4vmin] h-[34vmin] w-[0.8vmin] overflow-hidden rounded-full bg-white/20 portrait:hidden">
        <div className="absolute inset-x-0 bottom-0 rounded-full bg-moss-300" style={{ height: `${Math.min(100, (walk.height / 92) * 100)}%` }} />
      </div>
      <div className={`absolute inset-x-0 bottom-[26vmin] flex flex-col items-center gap-[0.8vmin] px-[6vmin] text-center ${skin.text}`}>
        <p key={stage.id} className="walk-caption font-display text-[clamp(22px,4.4vmin,90px)] font-medium [text-shadow:0_2px_24px_rgb(0_0_0/0.7)]">
          {caption.title}
        </p>
        <p className="text-[clamp(14px,2.1vmin,42px)] text-white/80 [text-shadow:0_1px_14px_rgb(0_0_0/0.7)]">{caption.text}</p>
      </div>
    </div>
  );
}
