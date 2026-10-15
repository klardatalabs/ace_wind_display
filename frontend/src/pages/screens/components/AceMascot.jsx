// Ace, the students screen's narrator: a cartoon of the turbine with a face (first drawn by
// Shashi for the old schools page), coloured like the real one, white with Enercon-green
// bands. Its blades turn at the live rotor speed, and its face follows the live mood:
// asleep in still air, squinting into a gale, in a hard hat when engineers are visiting.
// It is plain SVG and CSS, so it costs next to nothing to draw.

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "../../../hooks/useReducedMotion.js";

const INK = "var(--color-moss-950)";
const BAND = "var(--color-moss-400)";
// Above this wind (m/s) Ace squints and leans; the turbine reaches full power at 12.5.
const GALE_MS = 13;

/** Which face to pull, from the live mood (lib/mood.js) and wind. */
export function aceFace(mood, windMs) {
  if (mood === "fault" || mood === "maintenance") return "hardhat";
  if (mood === "storm") return "storm";
  if (mood === "calm") return "sleepy";
  if (windMs > GALE_MS) return "windy";
  return "happy";
}

/** Blades turning at `rpm`, driven by one rAF that only writes a transform. */
function useRotor(rpm) {
  const rotor = useRef(null);
  const rpmRef = useRef(rpm);
  rpmRef.current = rpm;
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    let angle = 0;
    let last = performance.now();
    let id;
    const frame = (now) => {
      angle = (angle + (rpmRef.current * 6 * (now - last)) / 1000) % 360; // rpm × 360° / 60 s
      last = now;
      rotor.current?.setAttribute("transform", `rotate(${angle.toFixed(2)} 250 230)`);
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(id);
  }, []);
  return rotor;
}

const BLADE = "M0,0 C16,-20 18,-100 8,-190 L-8,-190 C-18,-100 -16,-20 0,0 Z";

function Eyes({ face }) {
  if (face === "sleepy")
    return (
      <g stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round">
        <path d="M-30,-6 Q-18,6 -6,-6" />
        <path d="M6,-6 Q18,6 30,-6" />
      </g>
    );
  if (face === "storm" || face === "windy")
    return (
      <g stroke={INK} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M-30,-14 L-10,-6 L-30,2" />
        <path d="M30,-14 L10,-6 L30,2" />
      </g>
    );
  return (
    <g className="ace-blink">
      <ellipse cx="-18" cy="-8" rx="14" ry="18" fill="#fff" stroke={INK} strokeWidth="4" />
      <circle cx="-18" cy="-6" r="7" fill={INK} />
      <circle cx="-15" cy="-10" r="3.5" fill="#fff" />
      <ellipse cx="18" cy="-8" rx="14" ry="18" fill="#fff" stroke={INK} strokeWidth="4" />
      <circle cx="18" cy="-6" r="7" fill={INK} />
      <circle cx="21" cy="-10" r="3.5" fill="#fff" />
    </g>
  );
}

function Mouth({ face }) {
  if (face === "sleepy") return <path d="M-10,16 Q0,12 10,16" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />;
  if (face === "windy") return <path d="M-15,16 L15,16" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />;
  if (face === "storm") return <circle cx="0" cy="18" r="8" fill={INK} />;
  return <path d="M-18,14 Q0,32 18,14 Q0,18 -18,14 Z" fill="#ef4444" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />;
}

/**
 * @param {object} props
 * @param {string} props.mood     live mood (lib/mood.js)
 * @param {number} props.windMs   live wind speed
 * @param {number} props.rpm      live rotor speed
 * @param {boolean} [props.wave]  a friendly wiggle (the "Ask me" chapter)
 */
export default function AceMascot({ mood, windMs, rpm, wave = false, className = "" }) {
  const face = aceFace(mood, windMs);
  const rotor = useRotor(rpm);
  const lean = face === "storm" ? -7 : face === "windy" ? -Math.min(10, (windMs - 10) * 0.7) : 0;
  const gusts = face === "storm" || face === "windy";

  return (
    <div className={`relative ${className}`} role="img" aria-label={`Ace the turbine, ${face === "sleepy" ? "asleep" : face === "hardhat" ? "with engineers visiting" : face === "happy" ? "smiling" : "in strong wind"}`}>
      {face === "sleepy" && (
        <div className="ace-zzz pointer-events-none absolute top-[4%] right-[8%] font-display font-bold text-moss-600" aria-hidden="true">
          <span>Z</span>
          <span>z</span>
          <span>z</span>
        </div>
      )}
      {gusts && (
        <div className="pointer-events-none absolute top-[18%] -left-[12%] flex flex-col gap-[1.4vmin]" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="ace-gust block h-[0.6vmin] rounded-full bg-moss-300/80" style={{ width: `${10 - i * 2}vmin`, animationDelay: `${i * 0.35}s` }} />
          ))}
        </div>
      )}
      <svg viewBox="50 30 400 640" className={`block h-full w-auto overflow-visible ${wave ? "ace-wave" : "ace-bob"}`} aria-hidden="true">
        <defs>
          <linearGradient id="aceTower" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#dfe7ee" />
            <stop offset="40%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#c9d5df" />
          </linearGradient>
          <linearGradient id="aceBlade" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#d5dee6" />
          </linearGradient>
        </defs>
        <ellipse cx="250" cy="652" rx="110" ry="20" fill={INK} opacity="0.16" />
        <g className="transition-transform duration-700 ease-out" style={{ transformOrigin: "250px 650px", transform: lean ? `skewX(${lean}deg) rotate(${lean * 0.4}deg)` : "none" }}>
          {/* Tower, with the green bands the real one has near its foot */}
          <path d="M228,260 L272,260 L286,645 L214,645 Z" fill="url(#aceTower)" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
          <path d="M217.2,560 L282.8,560 L284,592 L216,592 Z" fill={BAND} />
          <path d="M215.6,604 L284.4,604 L285.2,624 L214.8,624 Z" fill="var(--color-moss-300)" />
          <rect x="206" y="640" width="88" height="18" rx="8" fill="var(--color-moss-700)" stroke={INK} strokeWidth="5" />
          {/* Nacelle */}
          <rect x="210" y="215" width="80" height="48" rx="20" fill="#f4f7fa" stroke={INK} strokeWidth="6" />
          <g ref={rotor}>
            <g transform="translate(250 230)">
              {[0, 120, 240].map((a) => (
                <path key={a} d={BLADE} transform={`rotate(${a})`} fill="url(#aceBlade)" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
              ))}
            </g>
          </g>
          {/* Nose cone and face, in front of the blades so they never cover it */}
          <circle cx="250" cy="230" r="44" fill="#e8eef3" stroke={INK} strokeWidth="6" />
          <circle cx="243" cy="221" r="37" fill="#ffffff" />
          <g transform="translate(250 230)">
            <ellipse cx="-32" cy="12" rx="9" ry="6" fill="#f43f5e" opacity="0.55" />
            <ellipse cx="32" cy="12" rx="9" ry="6" fill="#f43f5e" opacity="0.55" />
            <Eyes face={face} />
            <Mouth face={face} />
          </g>
          {face === "hardhat" && (
            <g transform="translate(250 190)">
              <path d="M-40,8 Q-40,-30 0,-32 Q40,-30 40,8 Z" fill="#fbbf24" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
              <rect x="-50" y="4" width="100" height="12" rx="6" fill="#f59e0b" stroke={INK} strokeWidth="5" />
              <path d="M0,-30 L0,4" stroke={INK} strokeWidth="4" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
