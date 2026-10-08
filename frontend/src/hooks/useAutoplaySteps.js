// Auto-advancing step index with a 0..1 progress value (for progress-ring step pills).
// Pauses while the element is off-screen or hovered.

import { useCallback, useEffect, useRef, useState } from "react";

export function useAutoplaySteps(count, intervalMs = 6000) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const paused = useRef(false);
  const visible = useRef(true);
  const elapsed = useRef(0);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([entry]) => (visible.current = entry.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    let raf;
    let last = performance.now();
    const loop = (t) => {
      const dt = t - last;
      last = t;
      if (!paused.current && visible.current) {
        elapsed.current += dt;
        if (elapsed.current >= intervalMs) {
          elapsed.current = 0;
          setIndex((i) => (i + 1) % count);
        }
        setProgress(elapsed.current / intervalMs);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [count, intervalMs]);

  const goTo = useCallback((i) => {
    elapsed.current = 0;
    setProgress(0);
    setIndex(i);
  }, []);

  const hoverProps = {
    onMouseEnter: () => (paused.current = true),
    onMouseLeave: () => (paused.current = false),
  };

  return { ref, index, progress, goTo, hoverProps };
}
