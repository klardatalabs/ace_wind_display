// Smoothly tweens a displayed number toward a live target (no jumpy digits on kiosks).

import { useEffect, useRef, useState } from "react";
import { gsap } from "../lib/gsap.js";

export function useTweenedNumber(target, { duration = 1.2, decimals = 0 } = {}) {
  const [value, setValue] = useState(target || 0);
  const proxy = useRef({ v: target || 0 });

  useEffect(() => {
    const tween = gsap.to(proxy.current, {
      v: target || 0,
      duration,
      ease: "power2.out",
      onUpdate: () => setValue(Number(proxy.current.v.toFixed(decimals))),
    });
    return () => tween.kill();
  }, [target, duration, decimals]);

  return value;
}
