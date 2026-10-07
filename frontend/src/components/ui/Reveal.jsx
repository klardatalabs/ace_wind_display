// Fades + lifts its children (staggered) the first time they scroll into view.

import { useRef } from "react";
import { gsap, useGSAP } from "../../lib/gsap.js";
import { prefersReducedMotion } from "../../hooks/useReducedMotion.js";

export default function Reveal({ as: Tag = "div", children, className = "", y = 28, stagger = 0.08, delay = 0, ...rest }) {
  const ref = useRef(null);
  useGSAP(
    () => {
      if (prefersReducedMotion()) return;
      gsap.from(ref.current.children, {
        y,
        opacity: 0,
        duration: 1,
        stagger,
        delay,
        ease: "power3.out",
        scrollTrigger: { trigger: ref.current, start: "top 85%", once: true },
      });
    },
    { scope: ref }
  );
  return (
    <Tag ref={ref} className={className} {...rest}>
      {children}
    </Tag>
  );
}
