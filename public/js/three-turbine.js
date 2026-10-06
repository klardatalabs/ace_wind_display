// Three.js Photorealistic 3D Turbine Controller
// Loads and renders the authentic Blender model: models/ace_turbine.glb
// Features PBR materials, dynamic sun shadows, realistic blade rotation,
// nacelle yaw steering, and interactive orbit camera.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export class ThreeTurbine {
  constructor(containerEl) {
    this.container = containerEl;
    this.targetRpm = 6.2;
    this.displayedRpm = 6.2;
    this.targetYawDeg = 0;
    this.displayedYawDeg = 0;
    this.rotorSpin = null;
    this.yawNode = null;
    this.aviationLight = null;
    this.isLoaded = false;
    this._raf = null;
    this._lastT = null;

    // Default hero camera framing (Frames whole 150m turbine with upward hero perspective)
    this.defaultCamPos = new THREE.Vector3(160, 65, 145);
    this.defaultCamTarget = new THREE.Vector3(0, 70, 0);

    this.init();
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth * 0.45;
    const height = this.container.clientHeight || window.innerHeight * 0.88;

    // 1. Scene
    this.scene = new THREE.Scene();

    // 2. Camera (Hero perspective looking up at 150m tower)
    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.5, 800);
    this.camera.position.copy(this.defaultCamPos);

    // 3. Renderer with ACES Tone Mapping & Shadows
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.renderer.domElement.className = "three-turbine-canvas";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.outline = "none";
    this.container.appendChild(this.renderer.domElement);

    // 4. Orbit Controls (Interactive inspection)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.target.copy(this.defaultCamTarget);
    this.controls.minDistance = 25;
    this.controls.maxDistance = 320;
    this.controls.maxPolarAngle = Math.PI / 2 + 0.04; // Don't clip below grass plane
    this.controls.update();

    // Double-click resets camera to hero angle
    this.renderer.domElement.addEventListener("dblclick", () => {
      this.resetCamera();
    });

    // 5. Lighting (Matched to sunny daylight over green hills)
    this.setupLighting();

    // 6. Ground Shadow Receiver Disc
    this.setupGroundPlane();

    // 7. Load GLB Model
    this.loadModel();

    // 8. Resize Listener & Initial Size Tick
    window.addEventListener("resize", () => this.onResize());
    requestAnimationFrame(() => this.onResize());

    // 9. Start Render Loop
    this.start();
  }

  setupLighting() {
    // Sky blue ambient wash from above, grass bounce from below
    const hemiLight = new THREE.HemisphereLight(0xbfe0ff, 0x3d6632, 1.1);
    hemiLight.position.set(0, 160, 0);
    this.scene.add(hemiLight);

    // Soft ambient fill
    const ambLight = new THREE.AmbientLight(0xffffff, 0.45);
    this.scene.add(ambLight);

    // Primary direct sunlight (Simulates afternoon sun in green-hills.jpg)
    const sunLight = new THREE.DirectionalLight(0xfff8eb, 2.4);
    sunLight.position.set(90, 160, 100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 400;

    const d = 95;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d * 1.3;
    sunLight.shadow.camera.bottom = -d * 0.4;
    sunLight.shadow.bias = -0.0004;
    this.scene.add(sunLight);

    // Subtle rim backlight for blade edges
    const rimLight = new THREE.DirectionalLight(0x8bc4ff, 0.65);
    rimLight.position.set(-80, 100, -70);
    this.scene.add(rimLight);
  }

  setupGroundPlane() {
    // Soft transparent ground disc that catches realistic tower and blade shadows
    const shadowGeo = new THREE.CircleGeometry(32, 64);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.ShadowMaterial({ opacity: 0.38 });
    const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
    shadowMesh.position.y = 0.05;
    shadowMesh.receiveShadow = true;
    this.scene.add(shadowMesh);
  }

  loadModel() {
    const loader = new GLTFLoader();
    loader.load(
      "/models/ace_turbine.glb",
      (gltf) => {
        this.model = gltf.scene;

        // Traverse & upgrade materials with high-fidelity PBR
        this.model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            const mat = child.material;
            if (mat) {
              mat.roughness = Math.max(0.18, Math.min(mat.roughness ?? 0.35, 0.6));
              mat.metalness = Math.min(mat.metalness ?? 0.05, 0.15);
              mat.envMapIntensity = 1.0;

              // Ensure vibrant white composite for blades & nacelle
              if (mat.name && mat.name.includes("Turbine_White")) {
                mat.roughness = 0.26;
                mat.metalness = 0.02;
              }

              // Enercon Green bands at tower base
              if (mat.name && mat.name.includes("Enercon_Green")) {
                mat.roughness = 0.32;
              }

              // Aviation warning beacon on nacelle
              if (mat.name && mat.name.includes("Aviation_Light")) {
                mat.emissive = new THREE.Color(0xff1122);
                mat.emissiveIntensity = 2.5;
                this.aviationLight = child;
              }
            }
          }
        });

        // Find critical animated nodes
        this.rotorSpin = this.model.getObjectByName("RotorSpin");
        this.yawNode = this.model.getObjectByName("Yaw");

        this.scene.add(this.model);
        this.isLoaded = true;

        // Trigger an initial resize & render
        this.onResize();

        // Dispatch loaded event
        const event = new CustomEvent("turbine3dLoaded", { detail: { nodes: { rotor: this.rotorSpin, yaw: this.yawNode } } });
        window.dispatchEvent(event);
      },
      undefined,
      (err) => {
        console.error("Failed to load ace_turbine.glb:", err);
      }
    );
  }

  setTelemetry({ rotorRpm, nacelleYaw }) {
    if (typeof rotorRpm === "number" && rotorRpm >= 0) {
      this.targetRpm = rotorRpm;
    }
    if (typeof nacelleYaw === "number") {
      this.targetYawDeg = nacelleYaw;
    }
  }

  resetCamera() {
    this.camera.position.copy(this.defaultCamPos);
    this.controls.target.copy(this.defaultCamTarget);
    this.controls.update();
  }

  onResize() {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  start() {
    if (this._raf) return;
    const animate = (t) => {
      if (this._lastT == null) this._lastT = t;
      const dt = Math.min(0.1, (t - this._lastT) / 1000);
      this._lastT = t;

      this.update(dt, t);
      this.render();
      this._raf = requestAnimationFrame(animate);
    };
    this._raf = requestAnimationFrame(animate);
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this._lastT = null;
  }

  update(dt, t) {
    // 1. Smooth RPM easing with multi-ton physical inertia
    const easing = this.displayedRpm < this.targetRpm ? 1.0 : 0.6;
    this.displayedRpm += (this.targetRpm - this.displayedRpm) * Math.min(1, dt * easing);

    // 2. Rotate 3D rotor (RotorSpin rotates around local X axis)
    if (this.rotorSpin) {
      // RPM to radians/sec: (RPM * 2 * PI) / 60
      const deltaRad = (this.displayedRpm * (Math.PI * 2) / 60) * dt;
      this.rotorSpin.rotateX(deltaRad);
    }

    // 3. Smooth Yaw steering (compass azimuth)
    if (this.yawNode && typeof this.targetYawDeg === "number") {
      // Interpolate yaw heading
      const diff = this.targetYawDeg - this.displayedYawDeg;
      this.displayedYawDeg += diff * Math.min(1, dt * 0.4);
      this.yawNode.rotation.y = THREE.MathUtils.degToRad(this.displayedYawDeg);
    }

    // 4. Subtle beacon pulse on top of nacelle
    if (this.aviationLight && this.aviationLight.material) {
      const pulse = 1.8 + Math.sin(t * 0.005) * 1.2;
      this.aviationLight.material.emissiveIntensity = Math.max(0.4, pulse);
    }

    // 5. Update orbit controls
    this.controls.update();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
