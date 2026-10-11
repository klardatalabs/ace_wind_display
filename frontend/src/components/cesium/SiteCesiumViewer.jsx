import { useEffect, useRef, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { SITE_COORDS, getSiteViewerConfig } from "../../cesium/siteConfig.js";
import { createSiteCamera } from "../../cesium/siteCamera.js";
import { animateTurbine, loadTurbineModel } from "../../cesium/turbineModel.js";

async function findGroundHeight(terrainProvider) {
  const deltaLat = 8 / 111320;
  const deltaLon = 8 / (111320 * Math.cos(Cesium.Math.toRadians(SITE_COORDS.lat)));
  const positions = [
    [SITE_COORDS.lon, SITE_COORDS.lat + deltaLat],
    [SITE_COORDS.lon, SITE_COORDS.lat - deltaLat],
    [SITE_COORDS.lon + deltaLon, SITE_COORDS.lat],
    [SITE_COORDS.lon - deltaLon, SITE_COORDS.lat],
  ].map(([lon, lat]) => Cesium.Cartographic.fromDegrees(lon, lat));
  const samples = await Cesium.sampleTerrainMostDetailed(terrainProvider, positions);
  const heights = samples.filter((sample) => sample && Number.isFinite(sample.height)).map((sample) => sample.height).sort((a, b) => a - b);
  if (heights.length < 3 || heights.at(-1) - heights[0] > 8) {
    throw new Error("Could not establish a reliable ground level at the turbine. A verified ground elevation is needed.");
  }
  return heights.length === 3 ? heights[1] : (heights[1] + heights[2]) / 2;
}

function turbineFootprint(lon, lat, radiusM = 62) {
  const points = Array.from({ length: 16 }, (_, index) => {
    const angle = index * Math.PI / 8;
    return Cesium.Cartesian3.fromDegrees(
      lon + Math.cos(angle) * radiusM / (111320 * Math.cos(Cesium.Math.toRadians(lat))),
      lat + Math.sin(angle) * radiusM / 111320
    );
  });
  return new Cesium.ClippingPolygon({ positions: points });
}

export default function SiteCesiumViewer({ className = "" }) {
  const rootRef = useRef(null);
  const cameraRef = useRef(null);
  const config = useRef(getSiteViewerConfig()).current;
  const [status, setStatus] = useState("loading");
  const [mode, setMode] = useState("orbit");
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!config.cesiumIonToken.trim()) {
      setStatus("needs-config");
      return undefined;
    }
    let cancelled = false;
    let viewer;
    let camera;
    let stopAnimation;

    async function init() {
      setStatus("loading");
      setMessage("");
      try {
        if (![SITE_COORDS.lat, SITE_COORDS.lon, config.turbineHeadingDeg, config.turbineHeightOffsetM, config.turbineScale].every(Number.isFinite)
          || Math.abs(SITE_COORDS.lat) > 90 || Math.abs(SITE_COORDS.lon) > 180 || config.turbineScale <= 0
          || (config.turbineGroundHeightM !== null && !Number.isFinite(config.turbineGroundHeightM))) {
          throw new Error("The site coordinates or turbine placement settings are invalid.");
        }
        if (config.cesiumIonToken) Cesium.Ion.defaultAccessToken = config.cesiumIonToken;
        const terrainProvider = Cesium.createWorldTerrainAsync();
        viewer = new Cesium.Viewer(rootRef.current, {
          animation: false, baseLayerPicker: false, fullscreenButton: false,
          geocoder: Cesium.IonGeocodeProviderType.GOOGLE, homeButton: false, infoBox: false,
          navigationHelpButton: false, sceneModePicker: false, selectionIndicator: false, timeline: false,
          baseLayer: Cesium.ImageryLayer.fromWorldImagery({ style: Cesium.IonWorldImageryStyle.AERIAL }),
          terrain: new Cesium.Terrain(terrainProvider),
        });
        viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
        viewer.scene.screenSpaceCameraController.minimumZoomDistance = 35;
        viewer.scene.screenSpaceCameraController.maximumZoomDistance = 4500;
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(SITE_COORDS.lon, SITE_COORDS.lat, 1400),
          orientation: { heading: 0, pitch: Cesium.Math.toRadians(-85), roll: 0 },
        });
        if (Cesium.ClippingPolygonCollection.isSupported(viewer.scene)) {
          const tileset = await Cesium.createGooglePhotorealistic3DTileset(
            { ...(config.googleMapTilesApiKey ? { key: config.googleMapTilesApiKey } : {}), onlyUsingWithGoogleGeocoder: true },
            { showCreditsOnScreen: true, enableCollision: true, maximumScreenSpaceError: 12 }
          );
          if (cancelled) { tileset.destroy(); return; }
          // The nearby bases are OpenStreetMap nodes 2807547707 and 2807547708.
          tileset.clippingPolygons = new Cesium.ClippingPolygonCollection({
            polygons: [
              turbineFootprint(SITE_COORDS.lon, SITE_COORDS.lat),
              turbineFootprint(-2.6733122, 51.5333800, 55),
              turbineFootprint(-2.6770489, 51.5346489, 55),
            ],
          });
          viewer.scene.primitives.add(tileset);
        }
        const groundHeight = config.turbineGroundHeightM ?? await findGroundHeight(await terrainProvider);
        if (cancelled) return;
        const model = await loadTurbineModel(config, groundHeight);
        if (cancelled) { model.destroy(); return; }
        viewer.scene.primitives.add(model);
        stopAnimation = animateTurbine(viewer.scene, model);
        camera = createSiteCamera(viewer, groundHeight);
        cameraRef.current = camera;
        setMode("orbit");
        setStatus("ready");
      } catch (error) {
        console.error("[site-viewer] initialization failed", error);
        if (!cancelled) {
          setMessage(error?.message || "The 3D site could not load.");
          setStatus("error");
        }
      }
    }
    // React's development Strict Mode runs setup-cleanup-setup synchronously.
    // Deferring starts only the surviving setup, so Cesium never fetches one tileset twice.
    const start = window.setTimeout(init, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(start);
      stopAnimation?.();
      camera?.dispose();
      cameraRef.current = null;
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
    };
  }, [attempt, config]);

  function changeMode(next) {
    cameraRef.current?.setMode(next);
    setMode(next);
  }

  return (
    <div className={`relative overflow-hidden bg-moss-950 [&_.cesium-geocoderContainer]:hidden ${className}`} data-lenis-prevent>
      <div ref={rootRef} className="absolute inset-0 [&_.cesium-widget-credits]:text-[10px]" aria-label="Interactive 3D location of the ACE wind turbine" />
      {status === "ready" && (
        <>
          <div className="absolute top-4 left-4 max-w-[calc(100%_-_7rem)] text-white md:top-6 md:left-6">
            <div className="flex flex-wrap gap-2 rounded-2xl bg-moss-950/85 p-2 shadow-xl backdrop-blur-md">
              <button type="button" aria-pressed={mode === "orbit"} onClick={() => changeMode("orbit")} className={`rounded-xl px-3 py-2 text-sm focus-visible:outline-white ${mode === "orbit" ? "bg-white text-moss-950" : "hover:bg-white/15"}`}>Orbit turbine</button>
              <button type="button" aria-pressed={mode === "explore"} onClick={() => changeMode("explore")} className={`rounded-xl px-3 py-2 text-sm focus-visible:outline-white ${mode === "explore" ? "bg-white text-moss-950" : "hover:bg-white/15"}`}>Explore site</button>
            </div>
            <p className="mt-2 rounded-xl bg-moss-950/80 px-3 py-2 text-xs backdrop-blur">
              {mode === "orbit" ? "Drag to rotate and tilt · Scroll or pinch to zoom" : "Drag to move around the real site · Scroll to zoom"}
            </p>
          </div>
          <div className="absolute top-4 right-4 flex flex-col gap-2 md:top-6 md:right-6">
            <button type="button" aria-label="Zoom in" onClick={() => cameraRef.current?.zoom(0.8)} disabled={mode !== "orbit"} className="size-10 rounded-xl bg-white text-xl text-moss-950 shadow-lg disabled:opacity-50">+</button>
            <button type="button" aria-label="Zoom out" onClick={() => cameraRef.current?.zoom(1.25)} disabled={mode !== "orbit"} className="size-10 rounded-xl bg-white text-xl text-moss-950 shadow-lg disabled:opacity-50">−</button>
            <button type="button" onClick={() => { cameraRef.current?.reset(); setMode("orbit"); }} className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-moss-950 shadow-lg">Reset view</button>
          </div>
        </>
      )}
      {status !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center bg-moss-950 p-6 text-center text-white">
          <div className="max-w-md">
            <p className="font-display text-2xl">{status === "needs-config" ? "Real-world view is being set up" : status === "error" ? "3D site unavailable" : "Loading the real site"}</p>
            <p className="mt-3 text-sm leading-6 text-white/70">{status === "needs-config" ? "Add a Cesium ion token to enable the real-world 3D map." : status === "error" ? message : "Streaming the 3D surroundings and positioning the ACE turbine."}</p>
            {status === "error" && <button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-5 rounded-full bg-white px-5 py-2 text-sm font-semibold text-moss-950">Try again</button>}
          </div>
        </div>
      )}
    </div>
  );
}
