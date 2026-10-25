import { useCallback, useEffect, useRef, useState } from "react";
import ExplorerCanvas from "../../components/three/ExplorerCanvas.jsx";
import SiteCesiumViewer from "../../components/cesium/SiteCesiumViewer.jsx";
import Icon from "../../components/ui/Icon.jsx";
import { Link } from "react-router";
import { EXPLORER_PARTS, OUTSIDE_PARTS, TOWER_PARTS, NACELLE_PARTS } from "../../content/explorerParts.js";
import ExplorerPartCard from "./components/ExplorerPartCard.jsx";
import "./liveExplorer.css";

export default function LiveExplorerPage() {
  const sceneRef = useRef(null);
  const mapControllerRef = useRef(null);
  const screenRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [pick, setPick] = useState(null);
  const [view, setView] = useState({ location: "outside", height: 1.7 });
  const [partsOpen, setPartsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(Boolean(document.fullscreenElement));
  const [fullscreenError, setFullscreenError] = useState("");
  const inside = view.location !== "outside";
  const choices = !inside ? OUTSIDE_PARTS : view.location === "tower" ? TOWER_PARTS : NACELLE_PARTS;

  const onPick = useCallback((part) => { setPick(part ?? null); setPartsOpen(false); }, []);
  const onViewChange = useCallback((next) => setView(previous => previous.location === next.location ? previous : next), []);
  const onReady = useCallback(() => setReady(true), []);
  const closeCard = useCallback(() => {
    setPick(null);
    mapControllerRef.current?.cancel();
    if (sceneRef.current?.explorer) { sceneRef.current.explorer.clearSelection(); sceneRef.current.explorer.cancel(); }
    requestAnimationFrame(() => {
      if (sceneRef.current) sceneRef.current.canvas.focus({ preventScroll: true });
      else mapControllerRef.current?.focusCanvas();
    });
  }, []);
  function enter(location) {
    closeCard();
    mapControllerRef.current?.cancel();
    setView({ location, height: location === "nacelle" ? 92.6 : 1.7 });
    if (location !== "outside") sceneRef.current?.explorer?.setLocation(location);
    setPartsOpen(false);
  }
  function choose(id) {
    if (inside) sceneRef.current?.explorer?.select(id);
    else mapControllerRef.current?.select(id);
  }
  function interiorReady() {
    sceneRef.current?.explorer?.setLocation(view.location);
    // The interior is reconstructed; the exterior remains the real streamed site.
    if (sceneRef.current) {
      sceneRef.current.world.group.visible = false;
      if (sceneRef.current.neighbour) sceneRef.current.neighbour.visible = false;
    }
  }

  useEffect(() => {
    const frame = () => mapControllerRef.current?.frameCard(!inside && Boolean(pick));
    frame();
    window.addEventListener("resize", frame);
    return () => window.removeEventListener("resize", frame);
  }, [pick, inside]);
  useEffect(() => {
    const oldTitle = document.title;
    document.title = "ACE · Live 3D explorer";
    return () => { document.title = oldTitle; };
  }, []);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      if (pick) closeCard();
      else if (partsOpen) setPartsOpen(false);
      else if (inside) enter("outside");
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pick, partsOpen, inside, closeCard]);
  useEffect(() => {
    const update = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  async function toggleFullscreen() {
    try {
      setFullscreenError("");
      if (document.fullscreenElement) await document.exitFullscreen();
      else await screenRef.current.requestFullscreen();
    } catch { setFullscreenError("Browser fullscreen is unavailable. The explorer already fills this page."); }
  }

  return (
    <main ref={screenRef} className={`live-explorer-screen ${pick ? "has-part" : ""} ${inside ? "is-inside" : ""}`} aria-label="ACE live 3D explorer" data-lenis-prevent>
      <div className={`live-explorer-stage ${inside ? "is-hidden" : ""}`}>
        <SiteCesiumViewer className="size-full" screenMode controllerRef={mapControllerRef} onPick={onPick} onReady={onReady} active={!inside} />
      </div>
      {inside && <div className="live-explorer-stage is-interior"><ExplorerCanvas sceneRef={sceneRef} onPick={onPick} onViewChange={onViewChange} onReady={interiorReady} /></div>}
      <>
        <Link to="/" className="explorer-home explorer-glass">← Home</Link>
        <div className="explorer-location explorer-glass"><span className="explorer-location-dot" />{inside ? view.location === "tower" ? "Inside the tower" : "Inside the nacelle" : "ACE · Lawrence Weston"}<span className="explorer-location-note">{inside ? "Illustrated interior" : "Real-world 3D site"}</span></div>
        <div className="explorer-tools explorer-glass" aria-label="View controls">
          <button className="explorer-icon-button" type="button" title="Zoom in" aria-label="Zoom in" onClick={() => inside ? sceneRef.current?.explorer?.zoom(.8) : mapControllerRef.current?.zoom(.8)}>+</button>
          <button className="explorer-icon-button" type="button" title="Zoom out" aria-label="Zoom out" onClick={() => inside ? sceneRef.current?.explorer?.zoom(1.25) : mapControllerRef.current?.zoom(1.25)}>−</button>
          <button className="explorer-icon-button" type="button" title="Whole turbine" aria-label="Whole turbine" onClick={() => { enter("outside"); mapControllerRef.current?.reset(); }}><Icon name="globe" className="size-5" /></button>
          {document.fullscreenEnabled && <button className="explorer-icon-button" type="button" title={fullscreen ? "Exit fullscreen" : "Fullscreen"} aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={toggleFullscreen}><span aria-hidden="true">⛶</span></button>}
        </div>
        <div className="explorer-actions explorer-glass">
          <button type="button" disabled={!ready && !inside} onClick={() => { sceneRef.current?.explorer?.stopMovement(); setPartsOpen(!partsOpen); }} aria-expanded={partsOpen} aria-controls="explorer-parts"><Icon name="layers" className="size-4" />Explore parts</button>
          <span className="explorer-action-divider" />
          {inside ? <button type="button" onClick={() => enter("outside")}><Icon name="globe" className="size-4" />Outside</button> : <button type="button" onClick={() => enter("tower")}><Icon name="cube" className="size-4" />Go inside</button>}
        </div>
        {partsOpen && <div id="explorer-parts" className="explorer-part-menu explorer-glass" aria-label="Choose a turbine part">
          <p className="explorer-eyebrow">{inside ? "Inspect the interior" : "Move closer to a part"}</p>
          {choices.map(id => <button key={id} type="button" onClick={() => choose(id)}>{EXPLORER_PARTS[id].title}<span aria-hidden="true">↗</span></button>)}
          {!inside && <button type="button" onClick={() => choose("turbine")}>About ACE<span aria-hidden="true">↗</span></button>}
        </div>}
        {inside && !partsOpen && <div className="explorer-interior-controls explorer-glass">
          <div className="explorer-room-switch" aria-label="Interior locations"><button type="button" aria-pressed={view.location === "tower"} onClick={() => enter("tower")}>Tower</button><button type="button" aria-pressed={view.location === "nacelle"} onClick={() => enter("nacelle")}>Machine room</button></div>
          <div className="explorer-movement" aria-label="Move inside the turbine">{[["left", "←"], ["forward", "↑"], ["right", "→"], ["down", "Down"], ["back", "↓"], ["up", "Up"]].map(([direction, label]) => <button key={direction} className="explorer-icon-button" type="button" aria-label={`Move ${direction}`}
            onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); sceneRef.current?.explorer?.hold(direction, true); }}
            onPointerUp={() => sceneRef.current?.explorer?.hold(direction, false)}
            onPointerCancel={() => sceneRef.current?.explorer?.hold(direction, false)}
            onLostPointerCapture={() => sceneRef.current?.explorer?.hold(direction, false)}
            onClick={event => { if (event.detail === 0) sceneRef.current?.explorer?.step(direction); }}>{label}</button>)}</div>
          <p className="explorer-key-hint">W A S D to move · E up / Q down · Shift to move faster</p>
        </div>}
        {fullscreenError && <p className="explorer-fullscreen-error" role="status">{fullscreenError}</p>}
      </>
      {pick && <ExplorerPartCard partId={pick.id} selectionKey={pick.selectionKey} selectionLabel={pick.label} inside={inside} onClose={closeCard} onEnter={enter} />}
    </main>
  );
}
