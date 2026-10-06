// Photorealistic 60 FPS Canvas Turbine Renderer
// Modeled precisely after the real Enercon E-115 EP3 at Avonmouth, Bristol.
// Features authentic aerodynamic blade chords, specular daylight highlights,
// 3D cylindrical shading, aviation safety markings, and smooth sub-pixel rotation.

export class PhotorealisticTurbine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.angleDeg = 0;
    this.targetRpm = 6.2;
    this.displayedRpm = 6.2;
    this._lastT = null;
    this._raf = null;

    this.resize();
    this._onResize = () => this.resize();
    window.addEventListener("resize", this._onResize);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.dpr = dpr;
    this.draw();
  }

  setTelemetry({ rotorRpm }) {
    if (typeof rotorRpm === "number" && rotorRpm >= 0) {
      this.targetRpm = rotorRpm;
    }
  }

  start() {
    if (this._raf) return;
    const render = (t) => {
      if (this._lastT == null) this._lastT = t;
      const dt = Math.min(0.1, (t - this._lastT) / 1000);
      this._lastT = t;

      // Realistic inertia: a multi-ton 115m rotor accelerates and decelerates with physical momentum
      const easingRate = this.displayedRpm < this.targetRpm ? 1.2 : 0.8;
      this.displayedRpm += (this.targetRpm - this.displayedRpm) * Math.min(1, dt * easingRate);
      
      // Calculate rotation angle (displayedRpm in RPM -> 6 deg/sec per RPM)
      this.angleDeg = (this.angleDeg + this.displayedRpm * 6 * dt) % 360;

      this.draw();
      this._raf = requestAnimationFrame(render);
    };
    this._raf = requestAnimationFrame(render);
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this._lastT = null;
  }

  draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (w === 0 || h === 0) return;

    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    const cssW = w / this.dpr;
    const cssH = h / this.dpr;

    // Authentic Enercon E-115 Proportions
    // Tower hub stands at ~32% from top, foundation on grass at ~82% height
    const hubX = cssW * 0.50;
    const baseY = cssH * 0.82;
    const hubY = cssH * 0.32;
    const towerH = baseY - hubY;
    
    // Blade radius proportional to 115m rotor vs 115m tower height (ratio ~ 0.58)
    const bladeR = Math.max(140, Math.min(cssH * 0.35, towerH * 0.62));

    // Slender, authoritative taper
    const towerBaseW = Math.max(26, towerH * 0.076);
    const towerTopW = Math.max(13, towerH * 0.038);

    // 1. Soft Grass Ambient Occlusion Shadow
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(hubX, baseY + 2, towerBaseW * 2.2, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(12, 36, 18, 0.45)";
    ctx.filter = "blur(8px)";
    ctx.fill();
    ctx.restore();

    // 2. Concrete Foundation Plinth Base
    ctx.save();
    const plinthGrad = ctx.createLinearGradient(hubX - towerBaseW * 1.3, baseY - 6, hubX + towerBaseW * 1.3, baseY + 6);
    plinthGrad.addColorStop(0, "#94a3b8");
    plinthGrad.addColorStop(0.35, "#e2e8f0");
    plinthGrad.addColorStop(0.7, "#cbd5e1");
    plinthGrad.addColorStop(1, "#64748b");
    ctx.beginPath();
    ctx.ellipse(hubX, baseY, towerBaseW * 1.25, 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = plinthGrad;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(100, 116, 139, 0.5)";
    ctx.stroke();
    ctx.restore();

    // 3. Tower Shaft (3D Cylindrical Daylight Shading)
    const towerGrad = ctx.createLinearGradient(hubX - towerBaseW / 2, 0, hubX + towerBaseW / 2, 0);
    towerGrad.addColorStop(0.0, "#9aa8b8"); // left ambient shadow
    towerGrad.addColorStop(0.18, "#dbe4ee"); // transition
    towerGrad.addColorStop(0.38, "#ffffff"); // specular sun reflection
    towerGrad.addColorStop(0.72, "#e9eef4"); // diffuse daylight wash
    towerGrad.addColorStop(0.95, "#9ca7b3"); // right rim occlusion
    towerGrad.addColorStop(1.0, "#838f9c");  // rim edge

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(hubX - towerTopW / 2, hubY);
    ctx.lineTo(hubX + towerTopW / 2, hubY);
    ctx.lineTo(hubX + towerBaseW / 2, baseY);
    ctx.lineTo(hubX - towerBaseW / 2, baseY);
    ctx.closePath();
    ctx.fillStyle = towerGrad;
    ctx.fill();

    // Tower base access door
    const doorH = Math.min(22, towerH * 0.05);
    const doorW = towerBaseW * 0.28;
    ctx.fillStyle = "#475569";
    ctx.beginPath();
    ctx.roundRect(hubX - doorW / 2, baseY - doorH - 2, doorW, doorH, [2, 2, 0, 0]);
    ctx.fill();

    // Aviation Red Warning Stripes (Enercon Specification: 2 horizontal bands)
    const stripe1Y = hubY + towerH * 0.50;
    const stripe2Y = hubY + towerH * 0.57;
    const stripeH = Math.max(7, towerH * 0.022);

    const stripeW1 = towerTopW + (towerBaseW - towerTopW) * 0.50;
    const stripeW2 = towerTopW + (towerBaseW - towerTopW) * 0.57;

    // Clip stripes to tower contour
    ctx.clip();

    // Stripe 1 with cylindrical shading
    const s1Grad = ctx.createLinearGradient(hubX - stripeW1 / 2, 0, hubX + stripeW1 / 2, 0);
    s1Grad.addColorStop(0, "#be123c");
    s1Grad.addColorStop(0.38, "#fb7185");
    s1Grad.addColorStop(0.7, "#e11d48");
    s1Grad.addColorStop(1, "#9f1239");
    ctx.fillStyle = s1Grad;
    ctx.fillRect(hubX - stripeW1 / 2, stripe1Y, stripeW1, stripeH);

    // Stripe 2 with cylindrical shading
    const s2Grad = ctx.createLinearGradient(hubX - stripeW2 / 2, 0, hubX + stripeW2 / 2, 0);
    s2Grad.addColorStop(0, "#be123c");
    s2Grad.addColorStop(0.38, "#fb7185");
    s2Grad.addColorStop(0.7, "#e11d48");
    s2Grad.addColorStop(1, "#9f1239");
    ctx.fillStyle = s2Grad;
    ctx.fillRect(hubX - stripeW2 / 2, stripe2Y, stripeW2, stripeH);

    ctx.restore(); // restore tower clip

    // 4. Nacelle (Egg / Teardrop Pod Housing atop tower)
    ctx.save();
    const nacelleL = Math.max(38, bladeR * 0.17); // extends to left/rear
    const nacelleH = Math.max(20, bladeR * 0.09);

    // Yaw bearing collar
    ctx.fillStyle = "#cbd5e1";
    ctx.fillRect(hubX - towerTopW * 0.6, hubY - 2, towerTopW * 1.2, 5);

    // Teardrop pod body
    const nacelleGrad = ctx.createLinearGradient(hubX - nacelleL, hubY - nacelleH, hubX + 8, hubY + nacelleH);
    nacelleGrad.addColorStop(0.0, "#ffffff");
    nacelleGrad.addColorStop(0.35, "#f1f5f9");
    nacelleGrad.addColorStop(0.80, "#cbd5e1");
    nacelleGrad.addColorStop(1.0, "#94a3b8");

    ctx.beginPath();
    ctx.moveTo(hubX + 8, hubY - nacelleH * 0.45);
    // Smooth upper curve sloping back
    ctx.bezierCurveTo(hubX - nacelleL * 0.2, hubY - nacelleH * 0.65, hubX - nacelleL * 0.75, hubY - nacelleH * 0.5, hubX - nacelleL, hubY - nacelleH * 0.15);
    // Rounded tail
    ctx.bezierCurveTo(hubX - nacelleL - 4, hubY, hubX - nacelleL - 4, hubY + nacelleH * 0.2, hubX - nacelleL, hubY + nacelleH * 0.35);
    // Lower curve sweeping back to yaw deck
    ctx.bezierCurveTo(hubX - nacelleL * 0.6, hubY + nacelleH * 0.6, hubX - nacelleL * 0.2, hubY + nacelleH * 0.55, hubX + 8, hubY + nacelleH * 0.45);
    ctx.closePath();
    ctx.fillStyle = nacelleGrad;
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctx.stroke();

    // Rear ultrasonic anemometer and aircraft warning beacon
    ctx.fillStyle = "#64748b";
    ctx.fillRect(hubX - nacelleL + 8, hubY - nacelleH * 0.5 - 7, 2.5, 7);
    // Tiny red beacon dot
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(hubX - nacelleL + 9.25, hubY - nacelleH * 0.5 - 7, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // 5. Rotating Rotor Assembly (3 NACA Airfoil Blades + Aerodynamic Bullet Spinner)
    ctx.save();
    ctx.translate(hubX, hubY);
    ctx.rotate((this.angleDeg * Math.PI) / 180);

    // Draw the 3 aerodynamic blades at 120-degree intervals
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate((i * 120 * Math.PI) / 180);
      this.drawAerodynamicBlade(ctx, bladeR);
      ctx.restore();
    }

    // Aerodynamic Bullet Nose Cone Spinner Hub
    const spinnerR = Math.max(13, bladeR * 0.055);
    const spinnerGrad = ctx.createRadialGradient(-spinnerR * 0.3, -spinnerR * 0.3, 2, 0, 0, spinnerR);
    spinnerGrad.addColorStop(0.0, "#ffffff");
    spinnerGrad.addColorStop(0.45, "#f8fafc");
    spinnerGrad.addColorStop(0.85, "#cbd5e1");
    spinnerGrad.addColorStop(1.0, "#94a3b8");

    ctx.beginPath();
    ctx.arc(0, 0, spinnerR, 0, Math.PI * 2);
    ctx.fillStyle = spinnerGrad;
    ctx.shadowColor = "rgba(15, 23, 42, 0.25)";
    ctx.shadowBlur = 10;
    ctx.fill();

    // Subtle spinner center cap
    ctx.beginPath();
    ctx.arc(0, 0, spinnerR * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(226, 232, 240, 0.7)";
    ctx.fill();

    ctx.restore(); // restore rotor rotation/translation

    ctx.restore(); // restore dpr scale
  }

  // Draw an authentic curved aerodynamic NACA airfoil blade with red tips
  drawAerodynamicBlade(ctx, R) {
    // R is blade length (~180px - 340px)
    // Real Enercon E-115 blade geometry:
    // Wide maximum chord shoulder at ~18% radius, tapering gracefully to slender curved tip
    const rootW = Math.max(5, R * 0.022);
    const chordMax = Math.max(14, R * 0.075); // widest chord belly
    const chordMaxY = -R * 0.19;
    const tipY = -R;
    const midY = -R * 0.60;

    ctx.save();

    // Subtle soft blade shadow for depth
    ctx.shadowColor = "rgba(15, 23, 42, 0.15)";
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // 3D Airfoil Camber Gradient across blade chord
    const bGrad = ctx.createLinearGradient(-chordMax, chordMaxY, chordMax, chordMaxY);
    bGrad.addColorStop(0.0, "#e2e8f0"); // leading edge subtle bevel
    bGrad.addColorStop(0.28, "#ffffff"); // specular sunlight reflection on camber peak
    bGrad.addColorStop(0.70, "#f8fafc"); // clean white composite blade
    bGrad.addColorStop(0.92, "#e2e8f0"); // diffuse trailing slope
    bGrad.addColorStop(1.0, "#94a3b8");  // sharp trailing edge shadow

    ctx.beginPath();
    // 1. Blade Root (attaches to spinner)
    ctx.moveTo(-rootW / 2, -6);

    // 2. Leading Edge: curves outward smoothly to max chord belly, then sweeps gracefully to the tip
    ctx.bezierCurveTo(
      -chordMax * 0.95, chordMaxY * 0.5,
      -chordMax,        chordMaxY,
      -chordMax * 0.68, midY
    );
    ctx.bezierCurveTo(
      -chordMax * 0.40, -R * 0.82,
      -3.5,             -R * 0.96,
      -1.2,             tipY
    );

    // 3. Rounded Aerodynamic Tip Cap
    ctx.arcTo(0, tipY - 2.5, 1.8, tipY, 2.5);

    // 4. Trailing Edge: slender aerodynamic taper down to chord shoulder and root
    ctx.bezierCurveTo(
      chordMax * 0.32, -R * 0.88,
      chordMax * 0.62, midY,
      chordMax * 0.78, chordMaxY
    );
    ctx.bezierCurveTo(
      chordMax * 0.55, chordMaxY * 0.5,
      rootW / 2,       -10,
      rootW / 2,       -6
    );
    ctx.closePath();

    ctx.fillStyle = bGrad;
    ctx.fill();

    ctx.shadowColor = "transparent"; // remove shadow for sharp stripes

    // Official Enercon E-115 Dual Red Aviation Warning Stripes
    const stripe1Start = -R * 0.82;
    const stripe1End = -R * 0.89;
    const stripe2Start = -R * 0.93;
    const stripe2End = -R * 0.99;

    ctx.save();
    ctx.clip(); // clip strictly inside blade boundary

    // Red Stripe 1 with daylight gradient
    const s1Grad = ctx.createLinearGradient(-chordMax, 0, chordMax, 0);
    s1Grad.addColorStop(0, "#be123c");
    s1Grad.addColorStop(0.3, "#f43f5e");
    s1Grad.addColorStop(0.8, "#e11d48");
    s1Grad.addColorStop(1, "#9f1239");
    ctx.fillStyle = s1Grad;
    ctx.fillRect(-chordMax * 2, stripe1End, chordMax * 4, stripe1Start - stripe1End);

    // Red Stripe 2
    ctx.fillRect(-chordMax * 2, stripe2End, chordMax * 4, stripe2Start - stripe2End);

    ctx.restore(); // restore stripe clip

    // Blade root hub cuff (dark gray collar connecting blade to pitch bearing)
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(-rootW * 0.65, -8, rootW * 1.3, 4);

    ctx.restore(); // restore blade save
  }
}
