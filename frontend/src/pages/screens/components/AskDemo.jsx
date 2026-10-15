// "Ask me" on the students screen: questions children might ask pop up one by one, then a
// finger taps one, it lights up, and Ace's answer arrives on a see-through card with a photo,
// as the real chat can send pictures. The taps take turns through the questions. It is
// labelled as an example; every answer is true (live figures, ACE's facts, Enercon's storm
// control in shared/physics.js), and the photos are ACE's.

import { useEffect, useState } from "react";
import { formatInt } from "../../../lib/format.js";

// The bubbles pop in first; then one is tapped every TURN_MS.
const FIRST_TAP_MS = 4200;
const TURN_MS = 7600;

const QUESTIONS = [
  {
    q: "How fast are your blades going?",
    a: (d) =>
      d.tipMph >= 1
        ? `Right now my blade tips are moving at ${formatInt(d.tipMph)} mph. ${d.tipMph > 60 ? "That's faster than a cheetah!" : "Not bad for a breezy day!"}`
        : "My blades are resting, because the wind is too light. When I'm spinning fast, my tips go faster than a car on the motorway!",
    photo: "/images/ace/in-operation.webp",
  },
  {
    q: "Who owns you?",
    a: () => "The people of Lawrence Weston! Neighbours set up Ambition Community Energy to build me, and the money I make goes back into the area.",
    photo: "/images/ace/community.webp",
  },
  {
    q: "What happens in a storm?",
    a: () => "When the wind gets really strong, I slow down bit by bit and turn my blades so they catch less wind. That keeps me safe.",
    photo: "/images/ace/blades-attached.webp",
  },
  {
    q: "How tall are you?",
    a: () => "From the ground to the tip of my blade is 150 metres. That's taller than Big Ben, which is 96 metres!",
    photo: "/images/ace/opening-crowd.webp",
  },
];

/** -1 while the bubbles are still popping in, then which tap we're on. */
function useTurn() {
  const [turn, setTurn] = useState(-1);
  useEffect(() => {
    let id;
    const first = setTimeout(() => {
      setTurn(0);
      id = setInterval(() => setTurn((t) => t + 1), TURN_MS);
    }, FIRST_TAP_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  return turn;
}

export default function AskDemo({ data }) {
  const turn = useTurn();
  const active = turn < 0 ? -1 : turn % QUESTIONS.length;
  const item = active >= 0 ? QUESTIONS[active] : null;

  return (
    <figure className="pointer-events-none absolute top-[17vh] left-[3vmin] z-10 flex w-[min(38vw,640px)] flex-col items-start gap-[1.6vmin] portrait:hidden" aria-label="Example chat with Ace">
      <figcaption className="rounded-full bg-moss-950/55 px-[1.6vmin] py-[0.4vmin] text-[clamp(10px,1.3vmin,24px)] font-semibold tracking-[0.12em] text-white uppercase backdrop-blur-md">Example chat</figcaption>
      <ul className="flex flex-col items-start gap-[1.4vmin]">
        {QUESTIONS.map((x, k) => (
          <li
            key={x.q}
            className={`milestone-in relative rounded-[2.4vmin] rounded-bl-[0.6vmin] px-[2.2vmin] py-[1.2vmin] text-[clamp(13px,2.1vmin,42px)] font-medium shadow-[0_10px_30px_rgb(10_21_29/0.15)] backdrop-blur-md transition-colors duration-300 ${
              k === active ? "bg-moss-500/90 text-white" : "bg-white/70 text-moss-900 ring-1 ring-white/60"
            }`}
            style={{ animationDelay: `${0.6 + k * 0.7}s`, marginLeft: `${(k % 2) * 4}vmin` }}
          >
            {x.q}
            {k === active && <span key={turn} className="ask-finger absolute top-1/2 left-[70%] block size-[4.4vmin] rounded-full border-[0.5vmin] border-white bg-moss-950/30" aria-hidden="true" />}
          </li>
        ))}
      </ul>
      {item && (
        <div key={turn} className="milestone-in flex w-full flex-col gap-[1.2vmin] rounded-[2.4vmin] rounded-tl-[0.6vmin] bg-white/55 p-[1.6vmin] text-moss-950 shadow-[0_16px_40px_rgb(10_21_29/0.2)] ring-1 ring-white/60 backdrop-blur-md" style={{ animationDelay: "0.9s" }}>
          <div className="flex items-center gap-[1vmin]">
            <span className="grid size-[3.6vmin] place-items-center rounded-full bg-moss-400 font-display text-[clamp(11px,1.6vmin,30px)] font-bold text-white">A</span>
            <span className="text-[clamp(11px,1.6vmin,30px)] font-semibold">Ace</span>
          </div>
          <p className="ask-typing flex gap-[0.6vmin] px-[0.4vmin]" style={{ animationDelay: "0.9s" }} aria-hidden="true">
            {[0, 1, 2].map((k) => (
              <span key={k} className="typing-dot block size-[1vmin] rounded-full bg-moss-500" style={{ animationDelay: `${k * 0.15}s` }} />
            ))}
          </p>
          <p className="milestone-in px-[0.4vmin] text-[clamp(13px,1.9vmin,38px)] leading-snug" style={{ animationDelay: "1.9s" }}>
            {item.a(data)}
          </p>
          <img src={item.photo} alt="" className="polaroid-drop block h-[19vh] w-full rounded-[1.4vmin] object-cover shadow-md" style={{ "--tilt": "0deg", animationDelay: "2.1s" }} />
        </div>
      )}
    </figure>
  );
}
