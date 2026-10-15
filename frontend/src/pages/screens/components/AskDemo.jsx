// "Ask me" on the hoarding screens: questions float up one by one, a hand pointer clicks one,
// the others drift away, and a see-through chat panel opens (the look of the real chat in
// pages/ask, without a phone around it: clear glass, just an outline and a soft blur). Ace
// types, its answer appears word by word, and for some questions a photo or a chart
// shimmers in above it, as the real chat shows pictures. Then the panel dissolves and the
// pointer picks the next question. Each screen asks its own questions, in its own voice.
// It is labelled as an example; every answer is true: live figures, the stored records,
// ACE's own facts (ambitioncommunityenergy.org), Enercon's design and the data licence the
// ACE API states. The photos are ACE's.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import TurbineMark from "../../../components/brand/TurbineMark.jsx";
import Icon from "../../../components/ui/Icon.jsx";
import { api } from "../../../lib/api.js";
import { formatInt } from "../../../lib/format.js";
import { E115_REFERENCE_CURVE } from "@shared/physics.js";

const PHOTO_CREDIT = "Photo: Ambition Community Energy";
const homesAbout = (n) => formatInt(n >= 200 ? Math.round(n / 10) * 10 : n);
const longDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long" });

/** Each screen's questions. `a(data, records)` writes the answer; `media` is a photo or a chart. */
const QUESTIONS = {
  students: [
    {
      q: "How fast are your blades going?",
      a: (d) =>
        d.tipMph >= 1
          ? `Right now my blade tips are moving at ${formatInt(d.tipMph)} mph. ${d.tipMph > 60 ? "That's faster than a cheetah!" : "Not bad for a breezy day!"}`
          : "My blades are resting, because the wind is too light. When I'm spinning fast, my tips go faster than a car on the motorway!",
      media: { photo: "/images/ace/blade-delivery.webp" },
    },
    {
      q: "How many homes are you powering?",
      a: (d) =>
        d.homes >= 1
          ? `Right now I'm making ${d.power.value} ${d.power.unit}, which is enough electricity for about ${homesAbout(d.homes)} homes. Over a whole year I make enough for more than 3,000 homes. And because the people of Lawrence Weston own me, the money from selling my electricity goes back into the neighbourhood.`
          : "Not many right now, because there isn't much wind. But over a whole year I make enough electricity for more than 3,000 homes. And because the people of Lawrence Weston own me, the money from selling it goes back into the neighbourhood.",
    },
    {
      q: "What happens in a storm?",
      a: () =>
        "I don't just stop when it gets wild! Sensors on my roof measure the wind all the time. When it gets really strong, I slow down bit by bit and twist my blades so they catch less of it. That keeps me safe, and I can often keep making some power while the storm blows.",
    },
    {
      q: "Are you taller than Big Ben?",
      a: () => "Yes! From the ground to the tip of my blade is 150 metres. Big Ben is 96 metres.",
      media: { photo: "/images/ace/in-operation.webp" },
    },
  ],
  community: [
    {
      q: "How many homes are you powering right now?",
      a: (d) =>
        d.homes >= 1
          ? `Right now the turbine is making ${d.power.value} ${d.power.unit}, enough electricity for about ${homesAbout(d.homes)} homes. Across a year it makes enough for more than 3,000, about the same as all the homes in Lawrence Weston use.`
          : "Not many this minute: the wind is too light. Across a year, though, it makes enough for more than 3,000 homes, about the same as all the homes in Lawrence Weston use.",
      media: { photo: "/images/ace/community.webp" },
    },
    {
      q: "Who owns this turbine?",
      a: () =>
        "We all do. Lawrence Weston residents set up Ambition Community Energy, through Ambition Lawrence Weston, to build and run it. It's wholly community owned, with no shareholders.",
      media: { photo: "/images/ace/ace-team.webp" },
    },
    {
      q: "Where does the money go?",
      a: () =>
        "The turbine sells its electricity to OVO Energy. After the running costs, the surplus is reinvested in Lawrence Weston, to help regenerate the area and tackle deprivation and poverty here.",
    },
    {
      q: "What was your best day ever?",
      a: (d, r) => {
        const best = r?.highest_daily_energy;
        if (!best) return "I keep a record of every day I've worked. Scan the code and ask me for my best one: I'll look it up in my history.";
        return `In the records stored here, since ${longDate(r.period.from)}, my best day was ${longDate(best.date)}. I made ${formatInt(best.energy_kwh)} kWh, about ${homesAbout(best.energy_kwh / 8.4)} homes' worth for a day, with the wind averaging ${best.avg_wind_ms.toFixed(1)} metres a second.`;
      },
    },
  ],
  college: [
    {
      q: "What's your capacity factor?",
      a: (d) =>
        d.capacityFactor > 0
          ? `Since generation began in 2023, the capacity factor is ${d.capacityFactor.toFixed(1)}%: the energy made, against running at the full 4,245 kW the whole time.`
          : "The lifetime total isn't in the live feed right now. Scan the code and I'll work it out from the stored history instead.",
    },
    {
      q: "Explain the power curve",
      a: (d) =>
        `Below 2.5 m/s the rotor idles. From cut-in, output rises steeply, roughly with the cube of wind speed, until about 12.5 m/s, where it reaches rated power and pitch control holds it. Above about 28 m/s storm control eases it down. Live: ${d.windSpeed.toFixed(1)} m/s, ${d.power.value} ${d.power.unit}.`,
      media: { chart: "curve" },
    },
    {
      q: "Why is there no gearbox?",
      a: () =>
        "The E-115 EP3 is direct drive. The rotor turns a large ring generator at blade speed, and electromagnets induce current in the stator coils. Fewer moving parts means less to wear out, and a full-power converter matches the output to the 50 Hz grid.",
      media: { photo: "/images/ace/blades-attached.webp" },
    },
    {
      q: "How is the open data licensed?",
      a: () =>
        "CC BY 4.0: you can reuse it, commercially too, as long as you credit it. Cite doi:10.5281/zenodo.22662372. The API sends the licence and citation with every response.",
    },
  ],
};

const TITLES = { students: "Ask Ace", community: "Ask Ace", college: "Ask Ace" };

// One question per turn. Times are milliseconds into the turn.
const TURN_MS = 9800;
const STEPS = [
  ["point", 1900], // the pointer glides to the question
  ["click", 2700], // ...and clicks it
  ["open", 3000], // the questions drift off...
  ["sent", 3400], // ...then the panel opens with the question sent
  ["typing", 3900],
  ["answer", 5000],
  ["close", 9100], // the panel dissolves
];
const WORD_MS = 60;

function useTurn(first) {
  const [turn, setTurn] = useState(first);
  const [step, setStep] = useState("bubbles");
  useEffect(() => {
    setStep("bubbles");
    const timers = STEPS.map(([name, at]) => setTimeout(() => setStep(name), at));
    timers.push(setTimeout(() => setTurn((t) => t + 1), TURN_MS));
    return () => timers.forEach(clearTimeout);
  }, [turn]);
  return { turn, step };
}

/** How many words of `text` are showing, revealed one at a time once `on`. */
function useStreamedWords(text, on) {
  const [count, setCount] = useState(0);
  const words = text.split(" ");
  useEffect(() => {
    if (!on) return setCount(0);
    setCount(1);
    const id = setInterval(() => setCount((c) => (c >= words.length ? c : c + 1)), WORD_MS);
    return () => clearInterval(id);
  }, [on, text, words.length]);
  return words.slice(0, count).join(" ");
}

/** The reference power curve drawing itself, with the live operating point on it. */
function CurveChart({ data }) {
  const X = (ms) => 12 + (ms / 30) * 276;
  const Y = (kw) => 128 - (kw / 4400) * 112;
  const d = E115_REFERENCE_CURVE.map((p, i) => `${i ? "L" : "M"}${X(p.wind).toFixed(1)},${Y(p.power).toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 300 140" className="block size-full bg-moss-950/80" aria-hidden="true">
      {[0, 1100, 2200, 3300, 4400].map((kw) => (
        <line key={kw} x1="12" x2="288" y1={Y(kw)} y2={Y(kw)} stroke="#ffffff" strokeOpacity="0.1" />
      ))}
      <path className="ask-curve" d={d} pathLength="1" fill="none" stroke="var(--color-moss-300)" strokeWidth="2.5" strokeLinejoin="round" />
      <circle className="ask-dot" cx={X(Math.min(30, data.windSpeed))} cy={Y(data.powerKw)} r="5" fill="#fff" stroke="var(--color-moss-400)" strokeWidth="2" />
      <text x="288" y="136" textAnchor="end" fontSize="8" fill="#ffffff99">wind m/s →</text>
      <text x="14" y="12" fontSize="8" fill="#ffffff99">kW</text>
    </svg>
  );
}

export default function AskDemo({ data, audience = "students", skin, side = "left", startAt = 0 }) {
  const questions = QUESTIONS[audience] ?? QUESTIONS.students;
  const { turn, step } = useTurn(startAt);
  const k = turn % questions.length;
  const item = questions[k];
  const [records, setRecords] = useState(null);
  const answer = item.a(data, records);
  const shown = useStreamedWords(answer, step === "answer" || step === "close");
  const [mediaReady, setMediaReady] = useState(false);
  const dark = Boolean(skin?.dark);

  // Have every photo fetched and decoded before it's needed, so none arrives blank, and
  // fetch the stored records for questions that need them.
  useEffect(() => {
    for (const { media } of questions) if (media?.photo) new Image().src = media.photo;
    if (questions.some((x) => x.a.length > 1)) api.records().then(setRecords).catch(() => {});
  }, [questions]);
  // A photo or chart shows a shimmer first, then itself.
  useEffect(() => {
    if (step !== "answer") return step === "bubbles" ? setMediaReady(false) : undefined;
    const id = setTimeout(() => setMediaReady(true), 600);
    return () => clearTimeout(id);
  }, [step]);

  // Where the pointer goes: the middle of the question it's about to click.
  const box = useRef(null);
  const bubbles = useRef([]);
  const [target, setTarget] = useState(null);
  useLayoutEffect(() => {
    const el = bubbles.current[k];
    if (!el || !box.current) return;
    const b = box.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setTarget({ x: r.left - b.left + r.width * 0.7, y: r.top - b.top + r.height * 0.55 });
  }, [k, turn]);

  const asking = step === "bubbles" || step === "point" || step === "click";
  const panel = step === "sent" || step === "typing" || step === "answer";
  const pointerAt = step === "point" || step === "click" ? target : null;
  const glassText = dark ? "text-white [text-shadow:0_1px_10px_rgb(0_0_0/0.7)]" : "text-moss-950 [text-shadow:0_1px_10px_rgb(255_255_255/0.95)]";

  return (
    <figure
      ref={box}
      className={`pointer-events-none absolute z-10 h-[64vh] portrait:hidden ${side === "left" ? "top-[21vh] left-[3vmin] w-[min(36vw,620px)]" : "top-[13vh] right-[3vmin] w-[min(32vw,580px)]"}`}
      aria-label="Example chat with Ace"
    >
      <figcaption className="absolute -top-[4.6vmin] left-0 rounded-full bg-moss-950/55 px-[1.6vmin] py-[0.4vmin] text-[clamp(10px,1.3vmin,24px)] font-semibold tracking-[0.12em] text-white uppercase backdrop-blur-md">Example chat</figcaption>

      {/* The questions, floating. (The list fades as a whole: each bubble's own pop-in animation would override a fade.) */}
      <ul key={`q-${turn}`} className={`flex flex-col items-start gap-[1.6vmin] pt-[1vmin] transition-[opacity,translate] duration-500 ${asking ? "" : "-translate-x-[6vmin] opacity-0"}`}>
        {questions.map((x, i) => (
          <li
            key={x.q}
            ref={(el) => (bubbles.current[i] = el)}
            className={`ask-float rounded-[2.4vmin] rounded-bl-[0.6vmin] px-[2.2vmin] py-[1.3vmin] text-[clamp(13px,2.1vmin,42px)] font-medium shadow-[0_10px_30px_rgb(10_21_29/0.12)] ring-[0.25vmin] backdrop-blur-[3px] transition-[scale,background-color] duration-300 ${
              i === k && step === "click" ? "scale-95 bg-moss-500 text-white ring-moss-400" : `bg-white/5 ring-white/80 ${glassText}`
            }`}
            style={{ marginLeft: `${(i % 2) * 4}vmin`, animationDelay: `${0.3 + i * 0.4}s, ${i * 0.35}s` }}
          >
            {x.q}
          </li>
        ))}
      </ul>

      {/* The hand pointer */}
      <div
        className={`absolute top-0 left-0 z-20 transition-[translate,opacity] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${pointerAt ? "opacity-100" : "opacity-0"}`}
        style={{ translate: pointerAt ? `${pointerAt.x}px ${pointerAt.y}px` : `${(target?.x ?? 200) + 160}px ${(target?.y ?? 200) + 140}px` }}
        aria-hidden="true"
      >
        {step === "click" && <span className="ask-click absolute -top-[2.4vmin] -left-[2.4vmin] block size-[4.8vmin] rounded-full border-[0.4vmin] border-white" />}
        <Icon name="handPointer" className={`size-[5.4vmin] text-white drop-shadow-[0_3px_6px_rgb(0_0_0/0.55)] transition-transform duration-150 ${step === "click" ? "scale-90" : ""}`} />
      </div>

      {/* The chat panel: clear glass, like a website's chat */}
      {(panel || step === "close") && (
        <div
          key={`p-${turn}`}
          className={`ask-panel absolute inset-x-0 top-0 flex flex-col overflow-hidden rounded-[3vmin] bg-white/5 shadow-[0_24px_70px_rgb(10_21_29/0.18)] ring-[0.25vmin] ring-white/80 backdrop-blur-[3px] transition-opacity duration-500 ${step === "close" ? "opacity-0" : "opacity-100"}`}
        >
          <div className={`flex items-center gap-[1.2vmin] border-b border-white/60 px-[2vmin] py-[1.3vmin] ${glassText}`}>
            <TurbineMark className="size-[4.6vmin] shrink-0" />
            <div className="leading-tight">
              <p className="font-display text-[clamp(13px,2vmin,38px)] font-semibold">{TITLES[audience] ?? "Ask Ace"}</p>
              <p className="text-[clamp(9px,1.2vmin,22px)] opacity-70">Weston Wind · {audience[0].toUpperCase() + audience.slice(1)} screen</p>
            </div>
          </div>
          <div className="flex flex-col gap-[1.4vmin] p-[1.8vmin] text-[clamp(12px,1.75vmin,34px)] leading-snug">
            <p className="ask-pop max-w-[85%] self-end rounded-[2.6vmin] rounded-br-[0.8vmin] bg-gradient-to-b from-moss-700 to-moss-900 px-[1.6vmin] py-[1.1vmin] text-white shadow-[0_6px_20px_rgb(10_21_29/0.18)]">{item.q}</p>
            {step !== "sent" && (
              <div className="ask-pop flex items-end gap-[0.9vmin]">
                <TurbineMark className="mb-[0.4vmin] size-[3.8vmin] shrink-0" />
                <div className="flex max-w-[88%] min-w-0 flex-col gap-[1vmin]">
                  {step !== "typing" && item.media && (
                    <figure className={`relative ${side === "left" ? "aspect-[16/9]" : "aspect-[2/1]"} overflow-hidden rounded-[2vmin] bg-moss-100 ring-1 ring-black/10`}>
                      {!mediaReady && <span className="ask-shimmer absolute inset-0" aria-hidden="true" />}
                      {mediaReady && item.media.photo && <img src={item.media.photo} alt="" className="ask-photo block size-full object-cover" />}
                      {mediaReady && item.media.photo && <figcaption className="absolute bottom-[0.6vmin] left-[1vmin] text-[clamp(8px,1.1vmin,20px)] text-white drop-shadow">{PHOTO_CREDIT}</figcaption>}
                      {mediaReady && item.media.chart === "curve" && <CurveChart data={data} />}
                    </figure>
                  )}
                  <div className="rounded-[2.6vmin] rounded-bl-[0.8vmin] bg-white/85 px-[1.6vmin] py-[1.1vmin] text-moss-950 ring-1 ring-white">
                    {step === "typing" ? (
                      <span className="flex gap-[0.6vmin] py-[0.5vmin]" aria-hidden="true">
                        {[0, 1, 2].map((dot) => (
                          <span key={dot} className="typing-dot block size-[1vmin] rounded-full bg-moss-500" style={{ animationDelay: `${dot * 0.15}s` }} />
                        ))}
                      </span>
                    ) : (
                      <span className={shown.length < answer.length ? "stream-caret" : ""}>
                        <span>{shown}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </figure>
  );
}
