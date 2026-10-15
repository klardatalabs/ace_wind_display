// The community screen's ending to the energy journey, in 3D: outside the home the power
// is heading for, an electric car drives up and parks at a street charger; a neighbour walks
// out of the front door, lifts the plug from the charger, carries it to the car and plugs
// it in; then power pulses down the cable, the charger's screen turns green and the car's
// charge light breathes. Low-poly, like the houses and trees around it.
//
// Everything is in the house's own frame (StoryRail places the group on the house): the
// house is 5.6 m wide and 8 m deep, centred on the origin; the street runs along x at
// z = -10.5, so the pavement and kerb are between z = -4 (the front wall) and z = -7.
// `update(t)` takes seconds since the ending began and is a pure function of it, so the
// scene can be scrubbed.

import * as THREE from "three";

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const easeOut = (t) => 1 - (1 - THREE.MathUtils.clamp(t, 0, 1)) ** 3;
const span = (t, a, b) => THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);

const LANE_Z = -8.45; // the car's centre line, tucked against the kerb
const PARKED_X = 1.0;
// The charger stands on the pavement on the camera's side of the car, facing the houses,
// so the plugging-in happens in full view.
const CHARGER = v(-2.25, 0, -6.55);
const PORT = v(-0.4, 0.92, -7.55); // on the car's kerb-side front wing, once parked
const DOOR = v(0.9, 0, -3.7);

/** Where the camera watches from, in the house's frame: from the far kerb, down the street. */
export const EV_SHOT = { eye: v(-11.5, 3.5, -14), look: v(-0.6, 0.95, -8.2) };
// The car comes up the street towards the camera, from this far along it.
const FROM_X = 36;

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, ...extra });

// ---------------------------------------------------------------- the car

function buildCar() {
  const car = new THREE.Group();
  car.name = "EvCar";
  // One solid, glossy red: it stands out from the green power line and the grass at dusk.
  const paint = mat(0xc2232b, { roughness: 0.32, metalness: 0.15 });
  const glass = mat(0x18242c, { roughness: 0.15, metalness: 0.6 });
  const dark = mat(0x1d2226, { roughness: 0.8 });

  // Side profile, front at +x, extruded across the car's width.
  const W = 1.78;
  const body = new THREE.Shape();
  [[-2.05, 0.3], [-2.12, 0.78], [-1.98, 1.04], [-1.5, 1.5], [0.5, 1.52], [1.32, 1.06], [2.0, 0.93], [2.13, 0.62], [2.05, 0.3]].forEach(([x, y], i) => (i ? body.lineTo(x, y) : body.moveTo(x, y)));
  const bodyGeo = new THREE.ExtrudeGeometry(body, { depth: W, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 });
  bodyGeo.translate(0, 0, -W / 2);
  car.add(new THREE.Mesh(bodyGeo, paint));

  // Side windows: the cabin outline, inset, poking just through both sides.
  const side = new THREE.Shape();
  [[-1.82, 1.08], [-1.44, 1.43], [0.46, 1.45], [1.18, 1.08]].forEach(([x, y], i) => (i ? side.lineTo(x, y) : side.moveTo(x, y)));
  const sideGeo = new THREE.ExtrudeGeometry(side, { depth: W + 0.13, bevelEnabled: false });
  sideGeo.translate(0, 0, -(W + 0.13) / 2);
  car.add(new THREE.Mesh(sideGeo, glass));
  // Windscreen and rear window, laid on the slopes.
  const screen = (from, to, width) => {
    const a = v(from[0], from[1], 0);
    const b = v(to[0], to[1], 0);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(a.distanceTo(b) * 0.86, width), glass);
    m.position.copy(a).lerp(b, 0.5);
    m.rotation.set(-Math.PI / 2, 0, Math.atan2(b.y - a.y, b.x - a.x), "XZY");
    return m;
  };
  const front = screen([0.52, 1.58], [1.39, 1.1], W - 0.25);
  const rear = screen([-1.54, 1.56], [-2.04, 1.1], W - 0.3);
  front.rotateX(Math.PI);
  car.add(front, rear);

  // Wheels, with light hubs.
  const tyre = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 20).rotateX(Math.PI / 2);
  const hub = new THREE.CylinderGeometry(0.2, 0.2, 0.25, 12).rotateX(Math.PI / 2);
  const wheels = [];
  for (const x of [-1.32, 1.36]) {
    for (const z of [-0.84, 0.84]) {
      const wheel = new THREE.Group();
      wheel.add(new THREE.Mesh(tyre, dark), new THREE.Mesh(hub, mat(0xb9c0c4, { metalness: 0.6, roughness: 0.3 })));
      wheel.position.set(x, 0.34, z);
      car.add(wheel);
      wheels.push(wheel);
    }
  }
  // Lights: white at the front, red at the back.
  const head = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d6, emissiveIntensity: 1.6 });
  const tail = new THREE.MeshStandardMaterial({ color: 0x8a1010, emissive: 0xff2a2a, emissiveIntensity: 1.2 });
  for (const z of [-0.62, 0.62]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.34), head);
    h.position.set(2.16, 0.78, z);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.36), tail);
    t.position.set(-2.16, 0.86, z);
    car.add(h, t);
  }
  // Headlight beams on the road (always in the scene, so the shaders never change; they
  // fade in and out with the drive).
  const beams = [-0.62, 0.62].map((z) => {
    const beam = new THREE.SpotLight(0xfff1d0, 0, 26, 0.42, 0.65, 1.4);
    beam.position.set(2.1, 0.78, z);
    beam.target.position.set(14, -0.4, z * 2.5);
    car.add(beam, beam.target);
    return beam;
  });
  // The charge port on the kerb side of the front wing, and its light.
  const portLight = new THREE.MeshStandardMaterial({ color: 0x103322, emissive: 0x3dff8e, emissiveIntensity: 0 });
  const port = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.04), portLight);
  // The car faces -x once placed (it drives towards the camera), so its kerb side is local -z.
  port.position.set(-(PORT.x - PARKED_X), PORT.y, -(W / 2 + 0.06));
  car.add(port);
  return { car, wheels, portLight, beams };
}

// ---------------------------------------------------------------- the charger

function buildCharger() {
  const g = new THREE.Group();
  g.name = "EvCharger";
  const shell = mat(0xeef1ef, { roughness: 0.4 });
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.38, 0.3), shell);
  post.position.y = 0.69;
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.08, 0.31), mat(0x1f9a58));
  band.position.y = 1.32;
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.08, 0.44), mat(0x8c9196, { roughness: 0.9 }));
  plinth.position.y = 0.04;
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x0e1418, emissive: 0x3dff8e, emissiveIntensity: 0 });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.17), screenMat);
  // Its face (screen, holster, socket) is on its +z side, towards the houses.
  screen.position.set(0, 1.08, 0.152);
  const holster = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.1), mat(0x23292d));
  holster.position.set(0.12, 0.86, 0.19);
  g.add(post, band, plinth, screen, holster);
  g.position.copy(CHARGER);
  return { charger: g, screenMat };
}

// ---------------------------------------------------------------- the street lamp

function buildLamp() {
  const g = new THREE.Group();
  g.name = "EvStreetLamp";
  const steel = mat(0x3a4146, { roughness: 0.6, metalness: 0.4 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5.2, 10), steel);
  pole.position.y = 2.6;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.1), steel);
  arm.position.set(0, 5.1, -0.5);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x2a2f33, emissive: 0xffd9a0, emissiveIntensity: 0 });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.5), headMat);
  head.position.set(0, 5.02, -1.0);
  const light = new THREE.PointLight(0xffd9a0, 0, 16, 1.6);
  light.position.set(0, 4.8, -1.0);
  g.add(pole, arm, head, light);
  g.position.set(CHARGER.x - 2.6, 0, CHARGER.z - 0.25);
  return { lamp: g, headMat, light };
}

// ---------------------------------------------------------------- the battery sign

/** A battery hanging over the car, filling as it charges. */
function buildBattery() {
  const g = new THREE.Group();
  g.name = "EvBattery";
  const ink = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false });
  const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.9, 0.44, 0.02)), ink);
  const nub = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.02), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false }));
  nub.position.x = 0.49;
  const fillMat = new THREE.MeshBasicMaterial({ color: 0x5dff9e, transparent: true, depthTest: false, toneMapped: false });
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.34).translate(0.4, 0, 0), fillMat);
  fill.position.x = -0.4;
  g.add(outline, nub, fill);
  for (const o of [outline, nub, fill]) o.renderOrder = 30;
  return { battery: g, fill, materials: [ink, nub.material, fillMat] };
}

// ---------------------------------------------------------------- the neighbour

function limb(radius, length, material) {
  // A capsule hanging from its top end, so rotating the pivot swings it like a limb.
  const pivot = new THREE.Group();
  const geo = new THREE.CapsuleGeometry(radius, length, 4, 10);
  geo.translate(0, -(length / 2 + radius), 0);
  pivot.add(new THREE.Mesh(geo, material));
  return pivot;
}

function buildPerson() {
  const person = new THREE.Group();
  person.name = "Neighbour";
  const jacket = mat(0xd3623b, { roughness: 0.8 });
  const trousers = mat(0x2c3640, { roughness: 0.85 });
  const skin = mat(0xc58c66, { roughness: 0.7 });
  const hair = mat(0x2b1d16, { roughness: 0.9 });

  const legs = [-0.1, 0.1].map((x) => {
    const leg = limb(0.075, 0.72, trousers);
    leg.position.set(x, 0.94, 0);
    person.add(leg);
    return leg;
  });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.4, 4, 12), jacket);
  torso.scale.set(1, 1, 0.72);
  torso.position.y = 1.22;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), skin);
  head.position.y = 1.64;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.126, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), hair);
  cap.position.y = 1.655;
  cap.rotation.x = -0.25;
  person.add(torso, head, cap);
  const arms = [-0.235, 0.235].map((x) => {
    const arm = limb(0.055, 0.52, jacket);
    arm.position.set(x, 1.46, 0);
    arm.rotation.z = x < 0 ? -0.08 : 0.08;
    person.add(arm);
    return arm;
  });
  // The right hand, for carrying the plug.
  const hand = new THREE.Object3D();
  hand.position.set(0, -0.68, 0.02);
  arms[1].add(hand);
  return { person, legs, arms, hand };
}

// ---------------------------------------------------------------- the scene

export function buildEvScene() {
  const group = new THREE.Group();
  group.name = "EvEnding";
  group.visible = false;

  const { car, wheels, portLight, beams } = buildCar();
  car.position.set(PARKED_X, 0, LANE_Z);
  car.rotation.y = Math.PI;
  const { charger, screenMat } = buildCharger();
  const { person, legs, arms, hand } = buildPerson();
  // The front door the neighbour comes out of.
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 2.05), mat(0x3a5a46, { roughness: 0.7 }));
  door.position.set(DOOR.x, 1.03, -4.03);
  door.rotation.y = Math.PI;
  const glow = new THREE.PointLight(0x7dffb4, 0, 6, 2);
  glow.position.copy(CHARGER).add(v(0, 1.1, 0.6));
  const { lamp, headMat, light: lampLight } = buildLamp();
  const { battery, fill, materials: batteryMats } = buildBattery();
  // Two rings of light that spread from the port the moment it's plugged in.
  const rings = [0, 1].map(() => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.2, 40), new THREE.MeshBasicMaterial({ color: 0x8dffc0, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
    ring.position.copy(PORT).add(v(0, 0, 0.05));
    group.add(ring);
    return ring;
  });
  group.add(car, charger, person, door, glow, lamp, battery);

  // The cable: from the charger to the plug (in the holster, the hand, then the car).
  const cableMat = mat(0x16191b, { roughness: 0.6 });
  const cable = new THREE.Mesh(new THREE.BufferGeometry(), cableMat);
  group.add(cable);
  const plug = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.09), mat(0x23292d));
  group.add(plug);
  // Power running down the cable once it's plugged in.
  const pulses = [0, 1, 2].map(() => {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), new THREE.MeshBasicMaterial({ color: 0x8dffc0, transparent: true, toneMapped: false }));
    group.add(p);
    return p;
  });

  const socket = CHARGER.clone().add(v(-0.1, 0.92, 0.16));
  const holster = CHARGER.clone().add(v(0.12, 0.86, 0.25));
  let lastPlug = null;
  let curve = null;
  const local = v(0, 0, 0);
  const at = v(0, 0, 0);

  function cableTo(end) {
    if (lastPlug && lastPlug.distanceToSquared(end) < 1e-6) return;
    lastPlug = end.clone();
    const sag = Math.max(0.12, Math.min(socket.y, end.y) - 0.35 - socket.distanceTo(end) * 0.12);
    const mid = socket.clone().lerp(end, 0.5).setY(sag);
    curve = new THREE.CatmullRomCurve3([socket, socket.clone().add(v(0, -0.25, 0.05)), mid, end.clone().add(v(0, 0.12, 0)), end]);
    cable.geometry.dispose();
    cable.geometry = new THREE.TubeGeometry(curve, 40, 0.022, 6, false);
  }

  /** Walks the neighbour between two points over [t0, t1], facing the way they go. */
  function walk(t, t0, t1, from, to) {
    const k = span(t, t0, t1);
    person.position.copy(from).lerp(to, ease(k));
    if (k > 0 && k < 1) person.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
    return k > 0 && k < 1;
  }

  // Standing at the charger's face, then beside the car's port, then back to watch.
  const AT_CHARGER = v(-2.15, 0, -5.75);
  const AT_CAR = v(-0.4, 0, -6.8);
  const STEP_BACK = v(-1.25, 0, -6.15);

  const parentQ = new THREE.Quaternion();

  /** `camera`, when given, turns the battery sign to face it. */
  function update(t, dt = 0, camera = null) {
    // The car rolls in and stops at the kerb.
    const drive = easeOut(span(t, 0.3, 4.2));
    const carX = FROM_X + (PARKED_X - FROM_X) * drive;
    const forward = car.position.x - carX; // it drives towards -x, nose first
    car.position.x = carX;
    for (const w of wheels) w.rotation.z -= forward / 0.34;

    // The neighbour: out of the door, to the charger, plug in hand to the car, plug in.
    person.visible = t >= 3.4;
    let walking = false;
    if (t < 6.2) walking = walk(t, 3.4, 5.7, DOOR.clone().setZ(-3.6), AT_CHARGER);
    else if (t < 8.4) walking = walk(t, 6.6, 8.1, AT_CHARGER, AT_CAR);
    else walking = walk(t, 9.4, 10.8, AT_CAR, STEP_BACK);
    if (!walking) {
      // Face what they're doing: the charger, then the car, then watch it charge.
      const face = t < 9.4 ? Math.PI : Math.atan2(car.position.x - 0.5 - person.position.x, LANE_Z - person.position.z);
      person.rotation.y += (face - person.rotation.y) * Math.min(1, dt * 6);
    }
    const stride = walking ? Math.sin(t * 9) : 0;
    legs[0].rotation.x = stride * 0.5;
    legs[1].rotation.x = -stride * 0.5;
    arms[0].rotation.x = -stride * 0.4;
    person.position.y = walking ? Math.abs(Math.cos(t * 9)) * 0.03 : 0;
    // The right arm reaches for the plug, carries it, pushes it in, then rests.
    const reach = ease(span(t, 5.7, 6.2)) * (1 - ease(span(t, 9.0, 9.5)));
    const push = ease(span(t, 8.1, 8.6));
    arms[1].rotation.x = walking && reach < 0.5 ? stride * 0.4 : -0.55 * reach - 0.5 * push * reach;

    // The plug: in the holster, then in the hand, then in the car.
    if (t < 6.1) at.copy(holster);
    else if (t < 8.5) {
      hand.getWorldPosition(at);
      group.worldToLocal(at);
    } else at.copy(PORT);
    plug.position.copy(at);
    cableTo(at);
    local.copy(at);

    // Headlights while it drives in; they dim once it's parked.
    const beam = t > 0.05 ? 22 * (1 - span(t, 4.6, 5.6)) : 0;
    for (const b of beams) b.intensity = beam;
    // The street lamp flickers on as dusk falls.
    const lampOn = span(t, 1.6, 2.4) * (t < 2.4 ? (Math.sin(t * 40) > 0 ? 1 : 0.2) : 1);
    headMat.emissiveIntensity = 2.2 * lampOn;
    lampLight.intensity = 18 * lampOn;

    // Charging: the screen, the port light and power down the cable.
    const charging = span(t, 8.6, 9.4);
    screenMat.emissiveIntensity = 1.6 * charging;
    portLight.emissiveIntensity = charging * (1.4 + 0.8 * Math.sin(t * 3.2));
    glow.intensity = 3 * charging;
    pulses.forEach((p, i) => {
      p.visible = charging > 0 && curve != null;
      if (p.visible) {
        curve.getPointAt((t * 0.6 + i / 3) % 1, p.position);
        p.material.opacity = charging;
      }
    });
    rings.forEach((ring, i) => {
      const k = span(t, 8.5 + i * 0.35, 9.8 + i * 0.35);
      ring.visible = k > 0 && k < 1;
      ring.scale.setScalar(1 + k * 9);
      ring.material.opacity = 0.9 * (1 - k);
    });
    // The battery over the car pops up and fills.
    const shown = span(t, 8.9, 9.4);
    battery.visible = shown > 0;
    battery.position.set(car.position.x, 2.35 + 0.05 * Math.sin(t * 2), LANE_Z);
    battery.scale.setScalar(0.4 + 0.6 * easeOut(shown));
    fill.scale.x = 0.25 + 0.75 * ease(span(t, 9.4, 15.5));
    for (const m of batteryMats) m.opacity = shown;
    if (camera) {
      group.getWorldQuaternion(parentQ).invert();
      battery.quaternion.copy(parentQ.multiply(camera.quaternion));
    }
  }

  function reset() {
    car.position.x = FROM_X;
    lastPlug = null;
    update(0);
  }

  return { group, update, reset, charger: CHARGER };
}
