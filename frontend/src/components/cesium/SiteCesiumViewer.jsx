import { useCallback, useEffect, useId, useRef, useState } from "react";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { SITE_COORDS, getSiteViewerConfig } from "../../cesium/siteConfig.js";
import { createSiteCamera } from "../../cesium/siteCamera.js";
import { createSiteSelection } from "../../cesium/siteSelection.js";
import { findTurbinePart } from "../../cesium/partPicking.js";
import { animateTurbine, loadTurbineModel } from "../../cesium/turbineModel.js";
import { applySiteEnvironment } from "../../cesium/siteEnvironment.js";
import ConditionsLine from "../live/ConditionsLine.jsx";
import { useSiteConditions } from "../../hooks/useSiteConditions.js";
import TurbineDetails from "./TurbineDetails.jsx";
import Icon from "../ui/Icon.jsx";
import "./siteViewer.css";

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

export default function SiteCesiumViewer({ className = "", screenMode = false, controllerRef, onPick, onReady, active = true }) {
  const rootRef = useRef(null);
  const cameraRef = useRef(null);
  const selectionRef = useRef(null);
  const markerRef = useRef(null);
  const selectedRef = useRef(false);
  const detailsId = useId();
  const config = useRef(getSiteViewerConfig()).current;
  const [status, setStatus] = useState("loading");
  const [selected, setSelected] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState("");
  const conditions = useSiteConditions();
  const viewerRef = useRef(null);
  const callbacksRef = useRef({ screenMode, onPick, onReady, active });
  callbacksRef.current = { screenMode, onPick, onReady, active };

  const selectTurbine = useCallback((picked = null) => {
    if (callbacksRef.current.screenMode) {
      cameraRef.current?.frameCard(true);
      callbacksRef.current.onPick?.(picked ?? { id: "turbine" });
      cameraRef.current?.focus(picked?.sphere);
      return;
    }
    if (selectedRef.current) return;
    selectedRef.current = true;
    setSelected(true);
    selectionRef.current?.setSelected(true);
    cameraRef.current?.focus();
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (viewer && !viewer.isDestroyed()) {
      viewer.useDefaultRenderLoop = active;
      if (active) viewer.resize();
    }
  }, [active]);

  const closeDetails = useCallback((overview = false) => {
    selectedRef.current = false;
    setSelected(false);
    selectionRef.current?.setSelected(false);
    cameraRef.current?.cancel();
    if (overview) cameraRef.current?.reset();
    requestAnimationFrame(() => markerRef.current?.focus({ preventScroll: true }));
  }, []);

  useEffect(() => {
    if (!selected) return undefined;
    // Clicking the WebGL canvas moves focus to the body. Escape must still work.
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDetails();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selected, closeDetails]);

  useEffect(() => {
    if (!config.cesiumIonToken.trim()) {
      setStatus("needs-config");
      return undefined;
    }
    let cancelled = false;
    let viewer;
    let camera;
    let stopAnimation;
    let stopEnvironment;
    let selection;
    let whiteShader;
    let stopReady;

    async function init() {
      setStatus("loading");
      setMessage("");
      selectedRef.current = false;
      setSelected(false);
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
          // No geocoder: its Knockout bindings compile with eval, which the CSP blocks.
          geocoder: false, homeButton: false, infoBox: false,
          navigationHelpButton: false, sceneModePicker: false, selectionIndicator: false, timeline: false,
          baseLayer: Cesium.ImageryLayer.fromWorldImagery({ style: Cesium.IonWorldImageryStyle.AERIAL }),
          terrain: new Cesium.Terrain(terrainProvider),
        });
        viewerRef.current = viewer;
        viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
        viewer.scene.screenSpaceCameraController.minimumZoomDistance = screenMode ? 3 : 35;
        viewer.scene.screenSpaceCameraController.maximumZoomDistance = 4500;
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(SITE_COORDS.lon, SITE_COORDS.lat, 1400),
          orientation: { heading: 0, pitch: Cesium.Math.toRadians(-85), roll: 0 },
        });
        let tileset;
        if (Cesium.ClippingPolygonCollection.isSupported(viewer.scene)) {
          tileset = await Cesium.createGooglePhotorealistic3DTileset(
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
        if (screenMode) {
          whiteShader = new Cesium.CustomShader({ fragmentShaderText: "void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) { material.diffuse = vec3(1.0); material.specular = vec3(0.04); material.roughness = 0.65; material.emissive = vec3(0.12); }" });
          model.customShader = whiteShader;
        }
        stopAnimation = animateTurbine(viewer.scene, model);
        stopEnvironment = applySiteEnvironment(viewer, tileset);
        camera = createSiteCamera(viewer, groundHeight, model);
        cameraRef.current = camera;
        selection = createSiteSelection(viewer, model, { marker: () => markerRef.current, onSelect: selectTurbine });
        selectionRef.current = selection;
        if (controllerRef) controllerRef.current = {
          select(id) { const picked = findTurbinePart(model, id); camera.frameCard(true); callbacksRef.current.onPick?.(picked); camera.focus(picked.sphere); },
          zoom: camera.zoom, reset: camera.reset, cancel: camera.cancel,
          frameCard: camera.frameCard,
          focusCanvas: () => { viewer.scene.canvas.tabIndex = 0; viewer.scene.canvas.focus({ preventScroll: true }); },
        };
        if (import.meta.env.DEV && new URLSearchParams(location.search).has("debug")) window.__liveMap = { viewer, model };
        setStatus("ready");
        viewer.useDefaultRenderLoop = callbacksRef.current.active;
        if (model.ready) callbacksRef.current.onReady?.();
        else stopReady = model.readyEvent.addEventListener(() => {
          stopReady?.();
          stopReady = null;
          if (!cancelled) callbacksRef.current.onReady?.();
        });
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
      stopEnvironment?.();
      stopReady?.();
      selection?.dispose();
      selectionRef.current = null;
      camera?.dispose();
      cameraRef.current = null;
      viewerRef.current = null;
      if (controllerRef) controllerRef.current = null;
      if (window.__liveMap?.viewer === viewer) delete window.__liveMap;
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
      if (whiteShader && !whiteShader.isDestroyed()) whiteShader.destroy();
    };
  }, [attempt, config, selectTurbine, screenMode, controllerRef]);

  return (
    <div className={`site-viewer relative overflow-hidden bg-moss-950 ${selected ? "has-selection" : ""} ${className}`} data-lenis-prevent>
      <div className="site-scene">
        <div ref={rootRef} className="absolute inset-0" aria-label="Interactive 3D location of the ACE wind turbine" />
        {status === "ready" && !screenMode && (
          <>
            <ConditionsLine conditions={conditions} className="site-conditions" />
            <button ref={markerRef} type="button" className="site-turbine-marker" hidden={selected}
              onClick={selectTurbine} aria-expanded={selected} aria-controls={selected ? detailsId : undefined}>
              <span className="site-marker-dot" aria-hidden="true" />
              <span>ACE turbine <span className="site-marker-action">Explore</span></span>
              <Icon name="arrowRight" className="size-4" />
            </button>
            {conditions.look.raining && <div className="rain-overlay pointer-events-none absolute inset-0" aria-hidden="true" />}
            <div className="site-map-controls">
              <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => cameraRef.current?.zoom(0.8)} className="site-icon-button">+</button>
              <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => cameraRef.current?.zoom(1.25)} className="site-icon-button">−</button>
              <button type="button" aria-label="Back to overview" title="Back to overview" onClick={() => closeDetails(true)} className="site-icon-button"><Icon name="globe" className="size-5" /></button>
            </div>
          </>
        )}
      </div>
      {status === "ready" && selected && <TurbineDetails id={detailsId} onClose={() => closeDetails()} onOverview={() => closeDetails(true)} />}
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
