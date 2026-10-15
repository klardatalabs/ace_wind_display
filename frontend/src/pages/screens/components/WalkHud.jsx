// Overlay while the camera climbs the tower: how high you are and where you are on the climb.
// With `timeline`, the climb also tells how the turbine was built: a year rail fills from
// the bottom up as you climb, and each milestone pops in as you pass it.

import { useEffect } from "react";
import { WALK_STAGES } from "../../../three/walk.js";
import { WALK_CAPTIONS } from "../../../content/screens.js";
import { BUILD_TIMELINE, BUILD_TIMELINE_TITLE, PHOTO_CREDIT } from "../../../content/buildTimeline.js";

const YEARS = [...new Set(BUILD_TIMELINE.map((m) => m.year))];

// The walk eases in and out (sine.inOut in TurbineScene.startWalk), so milestones are spaced
// by time rather than distance: each one stays up for the same few seconds.
const MILESTONE_AT = BUILD_TIMELINE.map((_, k) => 0.5 * (1 - Math.cos((Math.PI * k) / BUILD_TIMELINE.length)));

function milestoneAt(s) {
  let k = 0;
  while (k < MILESTONE_AT.length - 1 && s >= MILESTONE_AT[k + 1]) k++;
  return BUILD_TIMELINE[k];
}

function YearRail({ year, skin }) {
  const reached = YEARS.indexOf(year);
  return (
    <div className={`absolute top-[22vmin] left-[2.2vmin] flex flex-col gap-[1.6vmin] rounded-[2.4vmin] px-[2.4vmin] py-[2vmin] portrait:hidden ${skin.card}`}>
      <p className={`text-[clamp(12px,1.8vmin,34px)] font-semibold tracking-[0.14em] uppercase ${skin.accent}`}>{BUILD_TIMELINE_TITLE}</p>
      <div className={`relative flex flex-col-reverse gap-[3.4vmin] py-[0.6vmin] pl-[3.4vmin] ${skin.text}`}>
        <span className="absolute top-[1.6vmin] bottom-[1.6vmin] left-[0.9vmin] w-[0.5vmin] rounded-full bg-current opacity-20" />
        <span
          className="absolute bottom-[1.6vmin] left-[0.9vmin] w-[0.5vmin] rounded-full bg-moss-300 transition-[height] duration-1000 ease-out"
          style={{ height: `calc((100% - 3.2vmin) * ${reached / (YEARS.length - 1)})` }}
        />
        {YEARS.map((y, i) => (
          <div key={y} className="relative flex items-center">
            <span
              className={`absolute -left-[3.4vmin] block size-[2.3vmin] rounded-full border-[0.4vmin] transition-colors duration-500 ${
                i <= reached ? "border-moss-300 bg-moss-300" : "border-current bg-transparent opacity-40"
              }`}
            />
            {i === reached && <span className="absolute -left-[3.4vmin] block size-[2.3vmin] animate-ping rounded-full bg-moss-300/70" />}
            <span
              className={`font-display leading-none font-semibold tabular-nums transition-all duration-500 ${
                i === reached ? "text-[clamp(26px,5vmin,100px)]" : `text-[clamp(16px,2.6vmin,52px)] ${i < reached ? "opacity-75" : "opacity-35"}`
              }`}
            >
              {y}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Fetches the milestone photos as the climb starts, so each one is ready when it pops in. */
function usePreloadedPhotos(on) {
  useEffect(() => {
    if (!on) return;
    for (const m of BUILD_TIMELINE) if (m.photo) new Image().src = m.photo;
  }, [on]);
}

export default function WalkHud({ walk, skin, timeline = false }) {
  usePreloadedPhotos(timeline && Boolean(walk));
  if (!walk) return null;
  const stage = WALK_STAGES.find((s) => walk.s >= s.from && walk.s < s.to) ?? WALK_STAGES[WALK_STAGES.length - 1];
  const caption = WALK_CAPTIONS[stage.id];
  const milestone = timeline ? milestoneAt(walk.s) : null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className={`absolute top-[14vmin] right-[4vmin] flex items-end gap-[1.2vmin] rounded-[2vmin] px-[2.2vmin] py-[1.4vmin] ${skin.card}`}>
        <span className={`font-display text-[clamp(32px,7vmin,140px)] leading-none font-bold tabular-nums ${skin.text}`}>{Math.max(0, Math.round(walk.height))}</span>
        <span className={`pb-[0.6vmin] text-[clamp(14px,2.4vmin,48px)] ${skin.accent}`}>m up</span>
      </div>
      <div className="absolute top-[26vmin] right-[4vmin] h-[34vmin] w-[0.8vmin] overflow-hidden rounded-full bg-white/20 portrait:hidden">
        <div className="absolute inset-x-0 bottom-0 rounded-full bg-moss-300" style={{ height: `${Math.min(100, (walk.height / 92) * 100)}%` }} />
      </div>

      {milestone ? (
        <>
          <p key={stage.id} className="walk-caption absolute top-[24vmin] right-[6.5vmin] max-w-[32vmin] text-right text-[clamp(13px,2vmin,40px)] text-white/80 [text-shadow:0_1px_14px_rgb(0_0_0/0.7)] portrait:hidden">
            {caption.title}
          </p>
          <YearRail year={milestone.year} skin={skin} />
          <div className="absolute inset-x-0 bottom-[24vmin] flex justify-center px-[6vmin] landscape:right-[4vmin] landscape:left-[40vmin] landscape:px-0">
            <div key={milestone.id} className={`milestone-in flex max-w-[min(84vw,1600px)] items-center gap-[3vmin] rounded-[2.4vmin] p-[2vmin] ${milestone.photo ? "pr-[4vmin]" : "px-[4vmin]"} ${skin.card}`}>
              {milestone.photo && (
                <figure className="relative shrink-0 -rotate-2 rounded-[1vmin] bg-white p-[0.8vmin] pb-[2.6vmin] shadow-[0_10px_30px_rgb(0_0_0/0.3)] portrait:hidden">
                  <img src={milestone.photo} alt="" className="block h-[20vmin] w-[32vmin] rounded-[0.5vmin] object-cover" />
                  <figcaption className="absolute right-[1vmin] bottom-[0.6vmin] text-[clamp(9px,1.2vmin,22px)] text-moss-900/60">{PHOTO_CREDIT}</figcaption>
                </figure>
              )}
              <div className={`flex flex-col gap-[0.9vmin] ${milestone.photo ? "text-left portrait:text-center" : "items-center text-center"}`}>
                <p className={`text-[clamp(13px,2vmin,40px)] font-semibold tracking-[0.14em] uppercase ${skin.accent}`}>{milestone.when}</p>
                <p className={`font-display text-[clamp(24px,5vmin,100px)] leading-tight font-medium ${skin.text}`}>{milestone.title}</p>
                <p className={`max-w-[70vmin] text-[clamp(15px,2.4vmin,48px)] leading-snug ${skin.muted}`}>{milestone.text}</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className={`absolute inset-x-0 bottom-[26vmin] flex flex-col items-center gap-[0.8vmin] px-[6vmin] text-center ${skin.text}`}>
          <p key={stage.id} className="walk-caption font-display text-[clamp(22px,4.4vmin,90px)] font-medium [text-shadow:0_2px_24px_rgb(0_0_0/0.7)]">
            {caption.title}
          </p>
          <p className="text-[clamp(14px,2.1vmin,42px)] text-white/80 [text-shadow:0_1px_14px_rgb(0_0_0/0.7)]">{caption.text}</p>
        </div>
      )}
    </div>
  );
}
