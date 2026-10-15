import { useRef } from "react";
import { gsap, SplitText, useGSAP } from "../../../lib/gsap.js";
import { prefersReducedMotion } from "../../../hooks/useReducedMotion.js";
import Button from "../../../components/ui/Button.jsx";
import LiveBadge from "../../../components/live/LiveBadge.jsx";
import CodeBlock from "../../../components/ui/CodeBlock.jsx";

export default function DevHero({ origin }) {
  const root = useRef(null);
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      const split = SplitText.create(".dev-title", { type: "lines", mask: "lines" });
      gsap
        .timeline({ delay: 0.2 })
        .from(split.lines, { yPercent: 110, stagger: 0.08, duration: 1, ease: "expo.out" })
        .from(".dev-fade", { y: 20, opacity: 0, stagger: 0.1, duration: 0.8 }, "-=0.6")
        .from(".dev-code", { y: 40, opacity: 0, duration: 1, ease: "expo.out" }, "-=0.8");
      return () => split.revert();
    },
    { scope: root }
  );
  return (
    <section ref={root} className="px-6 pt-10 pb-16 md:px-12 xl:px-36">
      <div className="mx-auto grid max-w-[1280px] items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
        <div className="flex flex-col gap-6">
          <LiveBadge className="dev-fade w-fit" />
          <h1 className="dev-title font-display text-[clamp(2.6rem,5.5vw,4.75rem)] leading-[1.02] font-medium tracking-display text-moss-950">
            Build on a <i className="font-serif font-normal">real</i> wind turbine.
          </h1>
          <p className="dev-fade max-w-xl text-lg text-moss-900/70">
            Live telemetry over WebSockets, history and power curves over REST, a streaming chat API, the big screens' live connection, and instant open-data downloads. No key needed to read.
          </p>
          <div className="dev-fade flex flex-wrap gap-3">
            <Button href="#endpoints" icon="arrowRight">
              Explore the API
            </Button>
            <Button href="#data" variant="secondary" iconLeft="download">
              Download the data
            </Button>
          </div>
        </div>
        <CodeBlock
          className="dev-code shadow-[0_30px_80px_rgb(10_21_29/0.25)]"
          title="terminal"
          code={`curl ${origin}/api/state\n\n{\n  "mode": "live",\n  "now": {\n    "activePowerKw": 2980,\n    "windSpeed": 9.0,\n    "rotorRpm": 11.14,\n    "nacelleDeg": 215\n  },\n  "today": { "energyKwh": 12400 }\n}`}
        />
      </div>
    </section>
  );
}
