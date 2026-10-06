// Drives rotor rotation + nacelle yaw for an SVG turbine, continuously, at the
// real rotor RPM. Used by every persona page - each supplies its own SVG groups.

export class TurbineAnimator {
  constructor({ rotorGroupEl, nacelleGroupEl = null, onFrame = null }) {
    this.rotorGroupEl = rotorGroupEl;
    this.nacelleGroupEl = nacelleGroupEl;
    this.onFrame = onFrame;
    this.angleDeg = 0;
    this.targetRpm = 0;
    this.displayedRpm = 0;
    this.targetYawDeg = 0;
    this.currentYawDeg = 0;
    this._lastT = null;
    this._raf = null;
  }

  setTelemetry({ rotorRpm, nacelleDeg }) {
    if (typeof rotorRpm === "number" && rotorRpm >= 0) this.targetRpm = rotorRpm;
    if (typeof nacelleDeg === "number") this.targetYawDeg = nacelleDeg;
  }

  start() {
    const step = (t) => {
      if (this._lastT == null) this._lastT = t;
      const dtSec = Math.min(0.1, (t - this._lastT) / 1000);
      this._lastT = t;

      this.displayedRpm += (this.targetRpm - this.displayedRpm) * Math.min(1, dtSec * 1.5);
      this.angleDeg = (this.angleDeg + this.displayedRpm * 6 * dtSec) % 360;
      this.rotorGroupEl.setAttribute("transform", `rotate(${this.angleDeg.toFixed(2)})`);

      if (this.onFrame) this.onFrame(this.displayedRpm);

      this._raf = requestAnimationFrame(step);
    };
    this._raf = requestAnimationFrame(step);
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this._lastT = null;
  }
}

function shortestAngleDiff(from, to) {
  let diff = (to - from) % 360;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}
