// Overlay while the camera climbs the tower: how high you are and where you are on the climb.
// The height gauge is the whole turbine, so it's clear the climb ends in the machine room
// (92 m) while the blade tips reach 150 m. With `timeline`, the climb also tells how the
// turbine was built: a year rail fills from the bottom up as you climb, and each milestone
// pops in with its own little animated scene, and ACE's photo where there is one.

import { useEffect } from "react";
import { WALK_STAGES } from "../../../three/walk.js";
import { WALK_CAPTIONS } from "../../../content/screens.js";
import { BUILD_TIMELINE, BUILD_TIMELINE_TITLE, PHOTO_CREDIT } from "../../../content/buildTimeline.js";
import MilestoneArt from "./MilestoneArt.jsx";

const YEARS = [...new Set(BUILD_TIMELINE.map((m) => m.year))];
const HUB_M = 92;
const TIP_M = 150;

// The walk eases in and out (sine.inOut in TurbineScene.startWalk), so milestones are spaced
// by time rather than distance: each one stays up for the same few seconds.
const MILESTONE_AT = BUILD_TIMELINE.map((_, k) => 0.5 * (1 - Math.cos((Math.PI * k) / BUILD_TIMELINE.length)));

function milestoneAt(s) {
  let k = 0;
  while (k < MILESTONE_AT.length - 1 && s >= MILESTONE_AT[k + 1]) k++;
  return BUILD_TIMELINE[k];
}

/** The whole turbine to scale, with a dot climbing its tower. */
function HeightGauge({ height, place, skin }) {
  const GROUND = 152;
  const y = (m) => GROUND - (m / TIP_M) * 140;
  const r = (115.7 / 2 / TIP_M) * 140;
  const hub = y(HUB_M);
  const at = y(Math.max(0, height));
  return (
    <div className={`absolute top-[13vmin] right-[3vmin] flex flex-col items-end gap-[0.8vmin] rounded-[2vmin] px-[2vmin] py-[1.4vmin] ${skin.card}`}>
      <p className="flex items-baseline gap-[0.8vmin]">
        <span className={`font-display text-[clamp(30px,6.4vmin,130px)] leading-none font-bold tabular-nums ${skin.text}`}>{Math.max(0, Math.round(height))}</span>
        <span className={`text-[clamp(13px,2.2vmin,44px)] ${skin.accent}`}>m up</span>
      </p>
      <p key={place} className={`walk-caption text-[clamp(11px,1.7vmin,32px)] ${skin.muted}`}>{place}</p>
      <svg viewBox="0 0 176 160" className="h-[34vmin] w-auto portrait:hidden" aria-hidden="true">
        <line x1="10" y1={y(TIP_M)} x2="172" y2={y(TIP_M)} stroke="var(--color-moss-400)" strokeWidth="1.2" strokeDasharray="4 4" />
        <line x1="10" y1={hub} x2="172" y2={hub} stroke="var(--color-moss-400)" strokeWidth="1.2" strokeDasharray="4 4" />
        <path d={`M38,${GROUND} L41,${hub} L45,${hub} L48,${GROUND} Z`} fill="#fff" stroke="var(--color-moss-950)" strokeWidth="1.6" />
        {[0, 120, 240].map((a) => (
          <line key={a} x1="43" y1={hub} x2={43 + r * Math.sin((a * Math.PI) / 180)} y2={hub - r * Math.cos((a * Math.PI) / 180)} stroke="var(--color-moss-950)" strokeWidth="3" strokeLinecap="round" />
        ))}
        <circle cx="43" cy={hub} r="3.5" fill="#fff" stroke="var(--color-moss-950)" strokeWidth="1.5" />
        <line x1="0" y1={GROUND} x2="176" y2={GROUND} stroke="var(--color-moss-700)" strokeWidth="2.5" />
        <circle cx="43" cy={at} r="9" fill="var(--color-moss-300)" opacity="0.45" className="animate-ping" style={{ transformBox: "fill-box", transformOrigin: "center" }} />
        <circle cx="43" cy={at} r="5" fill="var(--color-moss-400)" stroke="#fff" strokeWidth="1.5" />
        <g fontSize="10" fontWeight="700" fill="var(--color-moss-900)" textAnchor="middle">
          <text x="120" y={y(TIP_M) - 4}>{TIP_M} m blade tip</text>
          <text x="120" y={hub - 4}>{HUB_M} m machine room</text>
          <text x="120" y={GROUND - 4}>ground</text>
        </g>
      </svg>
    </div>
  );
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

function MilestoneCard({ milestone, skin }) {
  return (
    <div className={`milestone-in relative flex max-w-[min(84vw,1500px)] items-center gap-[2.6vmin] rounded-[2.4vmin] py-[2vmin] pr-[3.6vmin] pl-[2vmin] ${skin.card}`}>
      {milestone.photo && (
        <figure className="polaroid-drop absolute -top-[19vmin] left-[2vmin] rounded-[0.8vmin] bg-white p-[0.7vmin] pb-[2.2vmin] shadow-[0_12px_30px_rgb(0_0_0/0.3)] portrait:hidden" style={{ "--tilt": "-3deg", animationDelay: "0.5s" }}>
          <img src={milestone.photo} alt="" className="block h-[15vmin] w-[24vmin] rounded-[0.4vmin] object-cover" />
          <figcaption className="absolute right-[0.8vmin] bottom-[0.5vmin] text-[clamp(8px,1.1vmin,20px)] text-moss-900/60">{PHOTO_CREDIT}</figcaption>
        </figure>
      )}
      <MilestoneArt id={milestone.id} className="h-[17vmin] w-[23vmin] shrink-0 rounded-[1.4vmin] bg-sky-50 portrait:hidden" />
      <div className="flex flex-col gap-[0.8vmin] text-left portrait:text-center">
        <p className={`text-[clamp(13px,2vmin,40px)] font-semibold tracking-[0.14em] uppercase ${skin.accent}`}>{milestone.when}</p>
        <p className={`font-display text-[clamp(24px,4.8vmin,96px)] leading-tight font-medium ${skin.text}`}>{milestone.title}</p>
        <p className={`max-w-[66vmin] text-[clamp(15px,2.3vmin,46px)] leading-snug ${skin.muted}`}>{milestone.text}</p>
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
      <HeightGauge height={walk.height} place={caption.title} skin={skin} />
      {milestone ? (
        <>
          <YearRail year={milestone.year} skin={skin} />
          <div className="absolute inset-x-0 bottom-[20vmin] flex justify-center px-[6vmin] landscape:right-[26vmin] landscape:left-[40vmin] landscape:px-0">
            <MilestoneCard key={milestone.id} milestone={milestone} skin={skin} />
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
