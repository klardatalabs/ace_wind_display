import { useEffect, useRef, useState } from "react";
import { useLiveStore } from "../../store/useLiveStore.js";
import { useEnvironmentStore } from "../../store/useEnvironmentStore.js";
import { resolveEnvironment } from "../../three/environment.js";

export default function ExplorerCanvas({ sceneRef, onPick, onViewChange, onReady, retryKey = 0 }) {
  const canvasRef = useRef(null);
  const callbacks = useRef({ onPick, onViewChange, onReady });
  callbacks.current = { onPick, onViewChange, onReady };
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    let scene;
    setStatus("loading");
    setMessage("");
    const update = () => {
      if (!scene) return;
      const state = useLiveStore.getState().state;
      const now = state?.now;
      const usable = state?.mode === "simulate" || Boolean(state?.liveAt);
      scene.setLive({ rotorRpm: usable ? now?.rotorRpm ?? 0 : 0, nacelleDeg: usable ? now?.nacelleDeg ?? 215 : 215 });
      const env = resolveEnvironment(useEnvironmentStore.getState().environment, { windMs: usable ? now?.windSpeed : null, windDeg: usable ? now?.aggregateWindDir : null });
      scene.setEnvironment(env);
      scene.setServerHour(env.hour);
    };
    const stopLive = useLiveStore.subscribe(update);
    const stopEnvironment = useEnvironmentStore.subscribe(update);
    async function init() {
      try {
        const { TurbineScene } = await import("../../three/TurbineScene.js");
        if (cancelled) return;
        scene = new TurbineScene(canvasRef.current, {
          explorer: true, interactive: false, frameShift: 0,
          onPick: (pick) => callbacks.current.onPick?.(pick),
          onViewChange: (view) => callbacks.current.onViewChange?.(view),
          onError: (error) => { if (!cancelled) { setStatus("error"); setMessage(error.message); } },
          onReady: () => {
            if (cancelled) return;
            setStatus("ready");
            callbacks.current.onReady?.();
          },
        });
        sceneRef.current = scene;
        if (import.meta.env.DEV && new URLSearchParams(location.search).has("debug")) window.__liveExplorer = scene;
        update();
        await scene.init();
      } catch (error) {
        if (!cancelled) { setStatus("error"); setMessage(error.message); }
      }
    }
    init();
    return () => {
      cancelled = true;
      stopLive();
      stopEnvironment();
      scene?.dispose();
      sceneRef.current = null;
      if (window.__liveExplorer === scene) delete window.__liveExplorer;
    };
  }, [sceneRef, retryKey]);

  return (
    <>
      <canvas ref={canvasRef} className="live-explorer-canvas" aria-label="Interactive ACE turbine. Select a part to inspect it. Drag to look around." />
      {status !== "ready" && (
        <div className="live-explorer-loading" role="status">
          <div>
            <span className="explorer-loading-mark" aria-hidden="true">↗</span>
            <h1>{status === "error" ? "The 3D explorer could not load" : "Getting ACE ready"}</h1>
            <p>{status === "error" ? message || "Try reloading the view." : "Preparing the turbine, landscape, and interior."}</p>
          </div>
        </div>
      )}
    </>
  );
}
