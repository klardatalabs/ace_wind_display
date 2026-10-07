// Mounts a TurbineScene in a full-size canvas and keeps it fed with live telemetry.
// Exposes the scene through `sceneRef` so pages can run story actions / phone commands.
// HUD labels for the "Look inside" parts are positioned by the scene every frame.

import { useEffect, useRef, useState } from "react";
import { useLiveStore } from "../../store/useLiveStore.js";
import { useReducedMotion } from "../../hooks/useReducedMotion.js";

export default function TurbineCanvas({ theme = "realistic", sceneRef, useSplat = true, interactive = true, showLabels = true, frameShift = 0, onLookInside, className = "" }) {
  const canvas = useRef(null);
  const labelRefs = useRef(new Map());
  const [labels, setLabels] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const reduced = useReducedMotion();
  const ownScene = useRef(null);
  const lookInsideCb = useRef(onLookInside);
  lookInsideCb.current = onLookInside;

  useEffect(() => {
    let scene;
    let cancelled = false;
    import("../../three/TurbineScene.js").then(({ TurbineScene }) => {
      if (cancelled) return;
      scene = new TurbineScene(canvas.current, {
        theme,
        useSplat,
        interactive,
        frameShift,
        onLookInside: (u) => lookInsideCb.current?.(u),
        onReady: () => setStatus("ready"),
        onError: () => setStatus("error"),
      });
      if (reduced) scene.rig.swayAmount = 0;
      ownScene.current = scene;
      if (sceneRef) sceneRef.current = scene;
      // ?debug exposes the scene for console poking and automated screenshots.
      if (new URLSearchParams(window.location.search).has("debug")) window.__scene = scene;
      const s = useLiveStore.getState().state?.now;
      if (s) scene.setLive({ rotorRpm: s.rotorRpm, nacelleDeg: s.nacelleDeg });
      scene.init().then(() => {
        if (cancelled) return;
        setLabels(scene.getLabels());
        scene.bindLabels(labelRefs.current);
      });
    });
    return () => {
      cancelled = true;
      scene?.dispose();
      if (sceneRef) sceneRef.current = null;
      ownScene.current = null;
    };
    // The scene is created once; theme changes are applied below without a rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    ownScene.current?.setTheme(theme);
  }, [theme]);

  // Live rpm + nacelle bearing straight from the store (no React re-render per update).
  useEffect(
    () =>
      useLiveStore.subscribe((st) => {
        const now = st.state?.now;
        if (now) ownScene.current?.setLive({ rotorRpm: now.rotorRpm, nacelleDeg: now.nacelleDeg });
      }),
    []
  );

  useEffect(() => {
    if (ownScene.current && labels.length) ownScene.current.bindLabels(labelRefs.current);
  }, [labels]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <canvas ref={canvas} className="block size-full cursor-grab active:cursor-grabbing" aria-label="Interactive 3D model of the Weston Wind turbine" />
      {showLabels && (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {labels.map((l) => (
            <div
              key={l.id}
              ref={(el) => (el ? labelRefs.current.set(l.id, el) : labelRefs.current.delete(l.id))}
              className="invisible absolute top-0 left-0 opacity-0 will-change-transform"
            >
              <div className="-translate-x-1/2 -translate-y-full pb-3">
                <div className="glass-ring rounded-2xl bg-moss-950/70 px-3.5 py-2 text-white shadow-[0_8px_30px_rgb(6_33_26/0.35)] backdrop-blur-md">
                  <p className="font-display text-[clamp(13px,1.05vw,20px)] font-semibold whitespace-nowrap">{l.text}</p>
                  <p className="text-[clamp(11px,0.8vw,15px)] whitespace-nowrap text-white/70">{l.detail}</p>
                </div>
                <span className="mx-auto mt-1 block h-5 w-px bg-white/70" />
                <span className="mx-auto block size-2.5 rounded-full bg-moss-300 ring-4 ring-moss-300/30" />
              </div>
            </div>
          ))}
        </div>
      )}
      {status !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="rounded-full bg-white/70 px-4 py-2 text-sm text-moss-800 backdrop-blur">
            {status === "error" ? "The 3D turbine couldn't load on this device." : "Building the turbine…"}
          </p>
        </div>
      )}
    </div>
  );
}
