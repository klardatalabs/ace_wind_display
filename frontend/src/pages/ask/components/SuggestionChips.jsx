import { useRef } from "react";
import { gsap, useGSAP } from "../../../lib/gsap.js";
import { prefersReducedMotion } from "../../../hooks/useReducedMotion.js";

export default function SuggestionChips({ suggestions, onPick, disabled }) {
  const ref = useRef(null);
  useGSAP(
    () => {
      if (!prefersReducedMotion()) gsap.from(ref.current.children, { y: 10, opacity: 0, stagger: 0.06, duration: 0.5, delay: 0.3 });
    },
    { scope: ref }
  );
  return (
    <div ref={ref} className="flex flex-wrap gap-2">
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          disabled={disabled}
          onClick={() => onPick(s)}
          className="rounded-full bg-white px-3.5 py-2 text-left text-sm text-moss-800 ring-1 ring-moss-200 transition hover:-translate-y-0.5 hover:bg-moss-50 hover:ring-moss-300 active:scale-95 disabled:opacity-50"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
