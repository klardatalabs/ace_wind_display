// Fresh words for this screen's story, written now and then by the server's language model
// (GET /api/stories). Null until they arrive, or when there are none: the screen then uses
// its hand-written words, so the story never waits on this.

import { useEffect, useState } from "react";

const REFRESH_MS = 20 * 60_000;

export function useGeneratedStories(screenKey) {
  const [stories, setStories] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/stories")
        .then((r) => (r.ok ? r.json() : null))
        .then((body) => alive && setStories(body?.screens?.[screenKey] ?? null))
        .catch(() => {});
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [screenKey]);
  return stories;
}
