// Drives a screen's story: advances chapters on a timer, runs each chapter's 3D action,
// and yields to visitors — a phone command (or a touch on the kiosk) pauses the loop for
// a while so their moment isn't cut short.

import { useCallback, useEffect, useRef, useState } from "react";

const PAUSE_AFTER_VISITOR_MS = 25_000;

export function useStoryLoop(chapters, sceneRef, rail = false) {
  const [index, setIndex] = useState(0);
  const [loop, setLoop] = useState(0); // times the story has come round (picks the words)
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [fade, setFade] = useState(0);
  const [railState, setRailState] = useState(null);
  const started = useRef(performance.now());
  const pausedUntil = useRef(0);
  // ?still keeps the story from running (for demos, screenshots and testing the 3D scene by hand)
  const still = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("still");

  // A visitor's phone or touch: a single named action.
  const runAction = useCallback(
    (action, value) => {
      if (action) sceneRef.current?.command(action, value);
    },
    [sceneRef]
  );

  // Enter a chapter: run its camera move / effect.
  useEffect(() => {
    if (still || rail) return undefined;
    started.current = performance.now();
    setProgress(0);
    // The scene may still be loading on the very first chapter; retry briefly.
    // A walk chapter waits a few seconds so its opening line can be read first.
    const chapter = chapters[index];
    let tries = 0;
    const attempt = () => {
      if (sceneRef.current?.lookInside) sceneRef.current.applyStage(chapter.stage);
      else if (tries++ < 40) timer = setTimeout(attempt, 250);
    };
    let timer = setTimeout(attempt, chapter.walk ? 4500 : 0);
    return () => clearTimeout(timer);
  }, [index, chapters, sceneRef, rail]);

  // Tick the progress ring and advance.
  useEffect(() => {
    if (rail) {
      const id = setInterval(() => {
        const state = sceneRef.current?.story?.getState();
        if (!state) return;
        setIndex(state.index);
        setProgress(state.progress);
        setFade(state.fade);
        setRailState(state);
      }, 100);
      return () => clearInterval(id);
    }
    if (still) return undefined;
    const id = setInterval(() => {
      const now = performance.now();
      if (now < pausedUntil.current) {
        started.current += 100; // freeze progress while a visitor is in control
        return;
      }
      if (paused) setPaused(false);
      const p = (now - started.current) / (chapters[index].seconds * 1000);
      if (p >= 1) {
        if (index + 1 === chapters.length) setLoop((l) => l + 1);
        setIndex((index + 1) % chapters.length);
      }
      else setProgress(p);
    }, 100);
    return () => clearInterval(id);
  }, [index, chapters, paused, rail, sceneRef]);

  const goTo = useCallback((i) => {
    const next = ((i % chapters.length) + chapters.length) % chapters.length;
    if (rail) sceneRef.current?.story?.seekChapter(next);
    setIndex(next);
  }, [chapters.length, rail, sceneRef]);

  /** A visitor (phone or touch) took control: run their action and hold the story. */
  const yieldTo = useCallback(
    (action, value) => {
      if (rail) { runAction(action, value); return; }
      pausedUntil.current = performance.now() + PAUSE_AFTER_VISITOR_MS;
      setPaused(true);
      runAction(action, value);
    },
    [runAction, rail]
  );

  return { index, loop, chapter: chapters[index], progress, paused, fade, railState, goTo, yieldTo };
}
