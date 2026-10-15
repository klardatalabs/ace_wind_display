// Mounts a TurbineScene in a full-size canvas and keeps it fed with live telemetry.
// Exposes the scene through `sceneRef` so pages can run story actions / phone commands.
// HUD labels for the "Look inside" parts are positioned by the scene every frame.
// With a `poster` (a still of the scene's first frame), that picture shows at once and
// fades into the live 3D when it's ready, instead of a loading message.

import { useEffect, useRef, useState } from "react";
import { useLiveStore } from "../../store/useLiveStore.js";
import { useEnvironmentStore } from "../../store/useEnvironmentStore.js";
import { resolveEnvironment } from "../../three/environment.js";
import { homesPoweredNow } from "@shared/impact.js";
import { useReducedMotion } from "../../hooks/useReducedMotion.js";

function pushLive(scene) {
  const now = useLiveStore.getState().state?.now;
  if (!now) return;
  scene.setLive({ rotorRpm: now.rotorRpm, nacelleDeg: now.nacelleDeg });
}

function pushEnvironment(scene) {
  const now = useLiveStore.getState().state?.now ?? {};
  const env = resolveEnvironment(useEnvironmentStore.getState().environment, { windMs: now.windSpeed, windDeg: now.aggregateWindDir });
  scene.setEnvironment({
    cloud: env.cloud,
    rain: env.rain,
    fog: env.fog,
    windMs: env.windMs,
    windDeg: env.windDeg,
    // 12,000 homes is what the turbine powers at full output
    litFraction: Math.min(1, homesPoweredNow(Math.max(0, now.activePowerKw ?? 0)) / 12000),
  });
  scene.setServerHour(env.hour);
}

export default function TurbineCanvas({ poster, theme = "realistic", sceneRef, interactive = true, showLabels = true, frameShift = 0, storyRail = false, storyTour = false, scan = false, maxFps = 0, maxPixelRatio, onLookInside, onWalk, onPick, tags = [], tagRefs, className = "" }) {
  const canvas = useRef(null);
  const labelRefs = useRef(new Map());
  const [labels, setLabels] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const reduced = useReducedMotion();
  const ownScene = useRef(null);
  const lookInsideCb = useRef(onLookInside);
  lookInsideCb.current = onLookInside;
  const walkCb = useRef(onWalk);
  walkCb.current = onWalk;
  const pickCb = useRef(onPick);
  pickCb.current = onPick;

  useEffect(() => {
    let scene;
    let cancelled = false;
    import("../../three/TurbineScene.js").then(({ TurbineScene }) => {
      if (cancelled) return;
      scene = new TurbineScene(canvas.current, {
        theme,
        interactive,
        frameShift,
        storyRail,
        storyTour,
        scan,
        maxFps,
        maxPixelRatio,
        onLookInside: (u) => lookInsideCb.current?.(u),
        onWalk: (s, height) => walkCb.current?.(s, height),
        onPick: (p) => pickCb.current?.(p),
        onReady: () => setStatus("ready"),
        onError: () => setStatus("error"),
      });
      if (reduced) scene.rig.swayAmount = 0;
      ownScene.current = scene;
      if (sceneRef) sceneRef.current = scene;
      // ?debug exposes the scene for console poking and automated screenshots.
      if (new URLSearchParams(window.location.search).has("debug")) window.__scene = scene;
      pushLive(scene);
      pushEnvironment(scene);
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

  // Live rpm, nacelle bearing, wind and homes straight from the stores (no React re-render per update).
  useEffect(
    () =>
      useLiveStore.subscribe(() => {
        if (!ownScene.current) return;
        pushLive(ownScene.current);
        pushEnvironment(ownScene.current);
      }),
    []
  );
  // Weather at the site, and any demo override from the server.
  useEffect(
    () =>
      useEnvironmentStore.subscribe(() => {
        if (!ownScene.current) return;
        pushEnvironment(ownScene.current);
      }),
    []
  );

  // Data tags attached to parts of the world (which anchor each one hangs from).
  useEffect(() => {
    const scene = ownScene.current;
    if (!scene) return;
    scene.setTags(tags.map((t) => ({ id: t.id, anchor: t.anchor })));
  }, [tags, status]);
  useEffect(() => {
    const scene = ownScene.current;
    if (scene && tagRefs) scene.bindTags(tagRefs.current);
  }, [tagRefs, tags, status]);

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
                <div className="glass-ring rounded-2xl bg-moss-950/70 px-3.5 py-2 text-white shadow-[0_8px_30px_rgb(10_21_29/0.35)] backdrop-blur-md">
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
      {poster && (
        <img
          src={poster}
          alt=""
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-[1400ms] ease-out ${status === "ready" ? "opacity-0" : "opacity-100"}`}
        />
      )}
      {status !== "ready" && (!poster || status === "error") && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="rounded-full bg-white/70 px-4 py-2 text-sm text-moss-800 backdrop-blur">
            {status === "error" ? "The 3D turbine couldn't load on this device." : "Building the turbine…"}
          </p>
        </div>
      )}
    </div>
  );
}
