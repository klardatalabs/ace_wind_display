// The Lawrence Weston gaussian-splat scan, shown around the turbine on the community screen.
// Spark is imported on demand, so the other screens never download it.
//
// lawrence-weston-site.splat is the real scan with its own blurry copy of this turbine cut
// out, trimmed by scripts/trim-scan.py to the sharp 900 m around the turbine (its outer
// ring fades out so it melts into the generated landscape). The scan is y-down and in
// arbitrary units, so it is flipped, scaled so its hub height matches the model (92 m),
// and moved so the turbine's spot is the origin. trim-scan.py uses the same numbers.

export const SPLAT_URL = "/scenes/lawrence-weston-site.splat";
const SCALE = 1.2432;
const POSITION = [-39.038, -0.497, -618.265];

/**
 * Loads the scan, invisible (opacity 0) so the caller can fade it in.
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.Scene} scene
 * @returns {Promise<{ splat: import("@sparkjsdev/spark").SplatMesh, spark: THREE.Object3D }>}
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
  splat.opacity = 0;
  await splat.initialized;
  scene.add(splat);
  return { splat, spark };
}
