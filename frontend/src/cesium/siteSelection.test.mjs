import test from "node:test";
import assert from "node:assert/strict";
import * as Cesium from "cesium";
import { createSiteSelection } from "./siteSelection.js";

function fixture(t) {
  const oldCancel = globalThis.cancelAnimationFrame;
  globalThis.cancelAnimationFrame = () => {};
  t.after(() => { globalThis.cancelAnimationFrame = oldCancel; });
  const canvas = new EventTarget();
  canvas.style = {};
  canvas.getBoundingClientRect = () => ({ left: 20, top: 40 });
  const captures = new Set();
  canvas.setPointerCapture = (id) => captures.add(id);
  canvas.hasPointerCapture = (id) => captures.has(id);
  canvas.releasePointerCapture = (id) => captures.delete(id);
  const model = { ready: true, silhouetteColor: Cesium.Color.RED, silhouetteSize: 0 };
  let picked = model;
  let selections = 0;
  const render = new Cesium.Event();
  const scene = { canvas, pick: () => ({ primitive: picked }), postRender: render };
  const selection = createSiteSelection({ scene }, model, { marker: () => null, onSelect: () => selections++ });
  function pointer(type, { id = 1, x = 60, y = 90, button = 0 } = {}) {
    const event = new Event(type);
    Object.assign(event, { pointerId: id, clientX: x, clientY: y, button, pointerType: "touch" });
    canvas.dispatchEvent(event);
  }
  return { selection, pointer, model, render, captures, pick: (target) => { picked = target; }, count: () => selections };
}

test("a turbine tap selects, even if a rotating blade moves away before release", (t) => {
  const f = fixture(t);
  f.pointer("pointerdown");
  f.pick({});
  f.pointer("pointerup");
  assert.equal(f.count(), 1);
  f.selection.dispose();
});

test("dragging away and back, pinching, cancellation, and right-click never select", (t) => {
  const f = fixture(t);
  f.pointer("pointerdown");
  f.pointer("pointermove", { x: 80 });
  f.pointer("pointermove", { x: 60 });
  f.pointer("pointerup");
  f.pointer("pointerdown", { id: 1 });
  f.pointer("pointerdown", { id: 2 });
  f.pointer("pointerup", { id: 1 });
  f.pointer("pointerup", { id: 2 });
  f.pointer("pointerdown");
  f.pointer("pointercancel");
  f.pointer("pointerdown", { button: 2 });
  f.pointer("pointerup", { button: 2 });
  assert.equal(f.count(), 0);
  f.selection.dispose();
});

test("surrounding buildings do not select the turbine", (t) => {
  const f = fixture(t);
  f.pick({});
  f.pointer("pointerdown");
  f.pointer("pointerup");
  assert.equal(f.count(), 0);
  f.selection.dispose();
});

test("cleanup removes callbacks, releases pointers, and restores model styling", (t) => {
  const f = fixture(t);
  f.selection.setSelected(true);
  assert.equal(f.model.silhouetteSize, 1.5);
  f.pointer("pointerdown");
  f.selection.dispose();
  assert.equal(f.render.numberOfListeners, 0);
  assert.equal(f.captures.size, 0);
  assert.equal(f.model.silhouetteSize, 0);
  assert.ok(Cesium.Color.equals(f.model.silhouetteColor, Cesium.Color.RED));
  f.pointer("pointerup");
  assert.equal(f.count(), 0);
});
