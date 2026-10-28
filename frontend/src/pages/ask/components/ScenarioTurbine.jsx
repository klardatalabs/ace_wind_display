import { useEffect, useRef, useState } from "react";

// Uses the same ACE GLB as the large screens, without their terrain, interiors or shader warm-up.
export default function ScenarioTurbine({ rpm = 0, direction = 215, windMs = 7 }) {
  const canvas = useRef(null);
  const target = useRef({ rpm, direction, windMs });
  const [status, setStatus] = useState("loading");
  target.current = { rpm, direction, windMs };

  useEffect(() => {
    let stopped = false;
    let dispose = () => {};
    Promise.all([import("three"), import("../../../three/loadTurbine.js"), import("../../../three/world/index.js"), import("../../../three/sky.js"), import("../../../three/environment.js")]).then(async ([THREE, { loadTurbine }, { buildWorld }, { createSky }, { skyState, sunDirection }]) => {
      if (stopped) return;
      const renderer = new THREE.WebGLRenderer({ canvas: canvas.current, antialias: true, alpha: true, powerPreference: "low-power" });
      renderer.setClearColor(0xffffff, 0);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene();
      const world = buildWorld();
      const skyMesh = createSky();
      scene.add(world.group, skyMesh);
      const sky = skyState({ elevation: 0.7, cloud: 0.35, windMs: 7 });
      const sunDirectionVector = sunDirection({ azimuth: 1.2, elevation: 0.7 });
      skyMesh.userData.apply(sky, sunDirectionVector);
      const windVector = new THREE.Vector2();
      let shownWind = null;
      const updateWind = () => {
        const { windMs: speed, direction: bearing } = target.current;
        if (shownWind === `${speed}:${bearing}`) return;
        shownWind = `${speed}:${bearing}`;
        const radians = THREE.MathUtils.degToRad(bearing);
        windVector.set(Math.sin(radians), Math.cos(radians));
        world.update({ time: performance.now() / 1000, sky, sunDir: sunDirectionVector, windMs: speed, windVec: windVector, rain: 0, litFraction: 0.2 });
      };
      updateWind();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1100);
      camera.position.set(165, 106, 120);
      camera.lookAt(0, 83, 0);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x53677a, 1.1));
      const sun = new THREE.DirectionalLight(0xffffff, 1.7);
      sun.position.set(100, 180, 120);
      scene.add(sun);
      const observer = new ResizeObserver(() => {
        const width = canvas.current?.clientWidth || 1;
        const height = canvas.current?.clientHeight || 1;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      });
      observer.observe(canvas.current);
      let frame;
      let last = performance.now();
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let shownRpm = 0;
      let shownYaw = 0;
      let nodes;
      let cameraOffset;
      const hubPosition = new THREE.Vector3();
      const draw = (now) => {
        if (stopped) return;
        const delta = Math.min((now - last) / 1000, 0.05);
        last = now;
        updateWind();
        world.tick(now / 1000);
        skyMesh.material.uniforms.uTime.value = now / 1000;
        if (nodes) {
          shownRpm += (target.current.rpm - shownRpm) * Math.min(1, delta * 2.5);
          const yaw = -(target.current.direction - 215) * Math.PI / 180;
          shownYaw += Math.atan2(Math.sin(yaw - shownYaw), Math.cos(yaw - shownYaw)) * Math.min(1, delta * 2);
          nodes.yaw.rotation.y = shownYaw;
          if (!reducedMotion) nodes.rotorSpin.rotation.x -= shownRpm * Math.PI / 30 * delta;
          nodes.root.updateMatrixWorld(true);
          nodes.hub.getWorldPosition(hubPosition);
          camera.position.copy(hubPosition).add(cameraOffset);
          camera.lookAt(hubPosition);
        }
        renderer.render(scene, camera);
        frame = requestAnimationFrame(draw);
      };
      dispose = () => {
        observer.disconnect();
        cancelAnimationFrame(frame);
        nodes?.root.traverse((object) => {
          if (object.isMesh) {
            object.geometry.dispose();
            (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => material?.dispose());
          }
        });
        world.group.traverse((object) => {
          object.geometry?.dispose();
          if (Array.isArray(object.material)) object.material.forEach((material) => material?.dispose());
          else object.material?.dispose();
        });
        skyMesh.geometry.dispose();
        skyMesh.material.dispose();
        renderer.dispose();
      };
      try {
        nodes = await loadTurbine();
        if (stopped) return;
        nodes.root.traverse((object) => { if (object.isMesh) { object.castShadow = false; object.receiveShadow = false; } });
        scene.add(nodes.root);
        // Fit the actual asset bounds; its GLB dimensions need not match the scene's metre scale.
        const bounds = new THREE.Box3().setFromObject(nodes.rotorSpin);
        nodes.root.updateMatrixWorld(true);
        const center = nodes.hub.getWorldPosition(new THREE.Vector3());
        const radius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
        // Keep the hub close, as in the site render; blades may extend beyond the frame.
        const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.27;
        cameraOffset = new THREE.Vector3(1, 0.08, 0.82).normalize().multiplyScalar(distance);
        camera.position.copy(center).add(cameraOffset);
        camera.lookAt(center);
        frame = requestAnimationFrame(draw);
        setStatus("ready");
      } catch { if (!stopped) setStatus("error"); }
    }).catch(() => { if (!stopped) setStatus("error"); });
    return () => { stopped = true; dispose(); };
  }, []);

  return <div className="scenario-turbine relative size-full overflow-hidden">
    <canvas ref={canvas} className="block size-full" aria-label="3D ACE turbine model responding to the selected scenario" />
    {status !== "ready" && <p role="status" className="pointer-events-none absolute inset-0 grid place-items-center bg-moss-50/85 px-4 text-center text-sm text-moss-700">{status === "loading" ? "Loading the turbine model…" : "The 3D model is unavailable. Scenario numbers remain visible below."}</p>}
    <span className="absolute bottom-3 left-3 rounded-lg bg-white/85 px-3 py-1.5 text-xs font-medium text-moss-900">Simulated rotor · {rpm.toFixed(1)} rpm</span>
  </div>;
}
