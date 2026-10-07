// The Lawrence Weston gaussian-splat scan, shown around the turbine in the realistic look.
// Spark is imported on demand so the cartoon and blueprint screens never download it.
//
// lawrence-weston-site.splat is the original scan with its own (blurry) copy of this
// turbine cut out. The scan is y-down and in arbitrary units, so it is flipped, scaled so
// its hub height matches the model (92 m), and moved so the turbine's spot is the origin.

export const SPLAT_URL = "/scenes/lawrence-weston-site.splat";
const SCALE = 1.2432;
const POSITION = [-39.038, -0.497, -618.265];

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @returns {Promise<{ splat: THREE.Object3D, spark: THREE.Object3D }>}
 */
export async function loadSiteSplat(renderer, scene, url = SPLAT_URL) {
  const { SparkRenderer, SplatMesh } = await import("@sparkjsdev/spark");
  const spark = new SparkRenderer({ renderer });
  spark.name = "SparkRenderer";
  scene.add(spark);

  const splat = new SplatMesh({ url });
  splat.name = "LawrenceWestonScan";
  splat.quaternion.set(1, 0, 0, 0); // 180° about x: y-down scan -> y-up world
  splat.scale.setScalar(SCALE);
  splat.position.set(...POSITION);
  splat.visible = false;
  await splat.initialized;
  scene.add(splat);
  return { splat, spark };
}
