import * as THREE from "three";

const v = (x, y, z) => new THREE.Vector3(x, y, z);

export const storyBatteryPercent = (seconds) => 1 + Math.floor(THREE.MathUtils.clamp(seconds - 90, 0, 8) * 0.6);

/** A separate illustrative room, not a reconstruction of anyone's home. */
export function buildStoryHome(origin) {
  const group = new THREE.Group();
  group.name = "StoryLawrenceWestonRoom";
  group.position.copy(origin);
  const textures = [];
  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.86, fog: false });
  const cream = mat(0xe7ddcc), wood = mat(0xa97852), dark = mat(0x223a3c), green = mat(0x4f9b76);
  const box = (size, at, material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...at);
    group.add(mesh);
    return mesh;
  };
  const canvasPlane = (width, height, at, draw, pixels = [1024, 512]) => {
    const canvas = document.createElement("canvas");
    [canvas.width, canvas.height] = pixels;
    const ctx = canvas.getContext("2d");
    draw(ctx, canvas);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, fog: false }));
    mesh.position.set(...at);
    group.add(mesh);
    return { mesh, canvas, ctx, texture };
  };
  const label = (text, at, width = 1.3) => {
    const pixels = Math.round(width / 0.20 * 128);
    return canvasPlane(width, 0.20, at, (ctx) => {
      ctx.clearRect(0, 0, pixels, 128);
      ctx.fillStyle = "#173a35";
      ctx.beginPath(); ctx.roundRect(2, 2, pixels - 4, 124, 28); ctx.fill();
      ctx.strokeStyle = "#79b69a"; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = "#f5f1e8"; ctx.font = "600 43px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(text, pixels / 2, 65, pixels - 50);
    }, [pixels, 128]);
  };
  // The physical cable and the glow share the same centreline, including the laptop port.
  const cablePoints = [[-2.15, 1.65, -2.13], [-2.15, 0.65, -2.13], [2.4, 0.65, -2.13], [2.4, 1.45, -2.13], [2.4, 1.45, -1.96], [2.4, 1.19, -0.9], [2.1, 1.15, -0.65], [2, 1.15, -0.65], [1.91, 1.15, -0.65]];
  const wire = (points, radius) => {
    const curve = new THREE.CurvePath();
    for (let i = 1; i < points.length; i++) curve.add(new THREE.LineCurve3(v(...points[i - 1]), v(...points[i])));
    curve.getPointAt = (u, target) => curve.getPoint(u, target);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 160, radius, 8, false), dark));
  };

  box([7, 0.24, 5.7], [0, -0.12, 0], wood);
  box([6.8, 3.4, 0.18], [0, 1.7, -2.55], cream);
  box([0.18, 2.1, 5.2], [-3.35, 1.05, 0], mat(0xd6cbb7));
  box([6.6, 0.12, 0.16], [0, 0.15, -2.39], wood);
  box([2.7, 0.05, 2.5], [0.5, 0.04, 0.35], mat(0x578477));
  box([3.2, 0.16, 1.4], [1, 1.02, -0.8], wood);
  for (const x of [-0.35, 2.35]) for (const z of [-1.3, -0.3]) box([0.12, 1, 0.12], [x, 0.5, z], dark);
  box([1.1, 0.15, 0.9], [1.1, 0.58, 0.9], dark);
  box([1.1, 1, 0.12], [1.1, 1.05, 1.32], mat(0x3a6f63));
  for (const x of [0.7, 1.5]) box([0.08, 0.6, 0.08], [x, 0.3, 0.9], wood);

  // The electrical sequence is visible on the open wall and continues to the desk.
  box([0.75, 0.95, 0.15], [-2.15, 1.65, -2.34], dark);
  box([0.66, 0.82, 0.04], [-2.15, 1.65, -2.24], cream);
  for (let i = 0; i < 5; i++) box([0.07, 0.18, 0.07], [-2.37 + i * 0.11, 1.68, -2.18], dark);
  label("Consumer unit", [-2.15, 2.32, -2.12], 1.25);
  wire(cablePoints.slice(0, 4), 0.016);
  box([0.48, 0.42, 0.1], [2.4, 1.45, -2.28], mat(0xf8f3e9));
  for (const x of [2.31, 2.49]) box([0.035, 0.085, 0.015], [x, 1.49, -2.215], dark);
  box([0.035, 0.06, 0.015], [2.4, 1.57, -2.215], dark);
  label("Wall socket", [2.4, 1.9, -2.12], 0.95);
  const click = label("Connected", [2.4, 2.25, -2.12], 1.3).mesh;
  const plug = box([0.2, 0.2, 0.23], [2.4, 1.45, -1.9], dark);
  const charger = box([0.3, 0.16, 0.55], [2.4, 1.18, -0.9], dark);
  wire(cablePoints.slice(3), 0.014);
  box([0.09, 0.04, 0.09], [1.91, 1.15, -0.65], dark);
  label("Charger", [2.4, 1.51, -0.65], 0.65);
  const led = box([0.06, 0.025, 0.07], [2.4, 1.272, -0.74], new THREE.MeshBasicMaterial({ color: 0x50635b, fog: false }));

  // A canvas screen lets the battery payoff stay crisp without a new asset.
  box([1.8, 0.07, 1.02], [1, 1.15, -0.65], dark);
  const lid = box([1.8, 1.15, 0.08], [1, 1.74, -1.12], dark);
  lid.rotation.x = -0.12;
  const screen = canvasPlane(1.66, 1.01, [1, 1.74, -1.062], () => {}, [1536, 960]);
  screen.mesh.rotation.x = -0.12;
  const keys = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.012, 0.07), mat(0x5a7974), 48);
  const matrix = new THREE.Matrix4();
  for (let row = 0; row < 4; row++) for (let col = 0; col < 12; col++) keys.setMatrixAt(row * 12 + col, matrix.makeTranslation(0.38 + col * 0.112, 1.195, -0.88 + row * 0.105));
  group.add(keys);
  box([0.4, 0.015, 0.22], [1, 1.196, -0.32], mat(0x476460));
  box([0.3, 0.05, 0.18], [-0.08, 1.15, -0.3], dark);
  for (const x of [-0.16, 0]) box([0.06, 0.04, 0.07], [x, 1.19, -0.3], green);
  box([0.15, 0.22, 0.15], [-0.45, 1.2, -0.5], cream);
  box([0.45, 0.1, 0.55], [-0.12, 1.15, -1], mat(0xc58e61));

  canvasPlane(1.4, 1.55, [-0.28, 2.32, -2.445], (ctx) => {
    ctx.fillStyle = "#31675d"; ctx.fillRect(0, 0, 1024, 1200);
    ctx.fillStyle = "#e7ddcc"; ctx.textAlign = "center";
    ctx.font = "bold 130px sans-serif"; ctx.fillText("BRISTOL", 512, 210);
    ctx.font = "56px sans-serif"; ctx.fillText("AVONMOUTH", 512, 350); ctx.fillText("LAWRENCE WESTON", 512, 440);
    ctx.strokeStyle = "#e7ddcc"; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(150, 850); ctx.lineTo(150, 620); ctx.lineTo(230, 620); ctx.lineTo(230, 850); ctx.moveTo(790, 850); ctx.lineTo(790, 620); ctx.lineTo(870, 620); ctx.lineTo(870, 850); ctx.moveTo(190, 620); ctx.quadraticCurveTo(512, 970, 830, 620); ctx.stroke();
    ctx.font = "bold 48px sans-serif"; ctx.fillText("OUR TURBINE. OUR POWER.", 512, 1080);
  }, [1024, 1200]);
  const pot = box([0.48, 0.5, 0.48], [-2.7, 0.25, -1.2], mat(0xb8704f));
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6), green);
    leaf.position.set(pot.position.x + Math.sin(i * 2) * 0.25, 0.7 + i * 0.13, -1.2);
    leaf.scale.set(0.7, 1.7, 0.5); group.add(leaf);
  }
  const light = new THREE.PointLight(0xffe3bb, 18, 14, 2);
  light.position.set(-1, 3, 2); group.add(light);

  let lastScreen = "";
  const update = (seconds) => {
    const charging = seconds >= 90;
    click.visible = seconds >= 89.4 && seconds < 90.8;
    plug.position.z = -1.82 - 0.3 * THREE.MathUtils.smoothstep(seconds, 88.5, 89.5);
    led.material.color.set(charging ? 0x8dffb6 : 0x50635b);
    charger.scale.setScalar(1 + (seconds >= 89.4 && seconds < 89.7 ? 0.08 : 0));
    const key = `${charging}|${Math.floor(seconds * 4)}`;
    if (key === lastScreen) return;
    lastScreen = key;
    const { ctx } = screen;
    ctx.fillStyle = "#102725"; ctx.fillRect(0, 0, 1536, 960);
    ctx.fillStyle = "#d8eee3"; ctx.font = "bold 52px sans-serif"; ctx.fillText("WESTON QUEST", 60, 90);
    ctx.font = "28px sans-serif"; ctx.fillStyle = "#98bbae"; ctx.fillText("BRISTOL · A LITTLE POWER, A BIG ADVENTURE", 60, 140);
    // A small procedural game view: terraces, an estuary and a turbine.
    ctx.fillStyle = "#3b7c76"; ctx.fillRect(60, 200, 1416, 350);
    ctx.fillStyle = "#95b58a"; ctx.fillRect(60, 360, 1416, 190);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? "#e2d1b3" : "#bf8360"; ctx.fillRect(115 + i * 130, 420, 85, 90);
      ctx.fillStyle = "#915b46"; ctx.beginPath(); ctx.moveTo(105 + i * 130, 420); ctx.lineTo(157 + i * 130, 375); ctx.lineTo(210 + i * 130, 420); ctx.fill();
    }
    ctx.strokeStyle = "#eef6e9"; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(1270, 510); ctx.lineTo(1270, 295); ctx.stroke();
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 + seconds * 0.2; ctx.beginPath(); ctx.moveTo(1270, 295); ctx.lineTo(1270 + Math.cos(a) * 85, 295 + Math.sin(a) * 85); ctx.stroke(); }
    ctx.fillStyle = charging ? "#8dffb6" : "#ffc18e";
    ctx.font = "bold 102px sans-serif"; ctx.fillText(`${storyBatteryPercent(seconds)}%`, 60, 705);
    ctx.font = "bold 66px sans-serif"; ctx.fillText(charging ? "Charging" : "Low battery", 310, 700);
    ctx.font = "34px sans-serif"; ctx.fillStyle = "#c0d8ca";
    ctx.fillText(charging ? "POWER CONNECTED · CHARGING ANIMATION" : "SAVE YOUR GAME · PLUG IN TO CONTINUE", 60, 805);
    ctx.strokeStyle = charging ? "#8dffb6" : "#ffc18e"; ctx.lineWidth = 9; ctx.strokeRect(1240, 610, 180, 90);
    ctx.fillStyle = charging ? "#8dffb6" : "#ffc18e"; ctx.fillRect(1255, 625, Math.max(8, storyBatteryPercent(seconds) / 100 * 150), 60);
    screen.texture.needsUpdate = true;
  };
  update(0);
  return { group, cablePoints: cablePoints.map((p) => v(...p).add(origin)), at: (x, y, z) => v(x, y, z).add(origin), update, dispose: () => textures.forEach((t) => t.dispose()) };
}
