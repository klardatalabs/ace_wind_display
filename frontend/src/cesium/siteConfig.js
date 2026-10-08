const env = import.meta.env ?? {};

export const SITE_COORDS = {
  lat: Number(env.VITE_SITE_LAT ?? 51.5388355),
  lon: Number(env.VITE_SITE_LON ?? -2.6717359),
};

export const TURBINE_MODEL_URL = "/models/ace-turbine.glb";

export const GOOGLE_TILES_ROOT = "https://tile.googleapis.com/v1/3dtiles/root.json";

export function getSiteViewerConfig() {
  return {
    cesiumIonToken: env.VITE_CESIUM_ION_TOKEN ?? "",
    googleMapTilesApiKey: env.VITE_GOOGLE_MAP_TILES_API_KEY ?? "",
    turbineHeadingDeg: Number(env.VITE_TURBINE_HEADING_DEG ?? 0),
    turbineGroundHeightM: env.VITE_TURBINE_GROUND_HEIGHT_M === undefined || env.VITE_TURBINE_GROUND_HEIGHT_M === ""
      ? null
      : Number(env.VITE_TURBINE_GROUND_HEIGHT_M),
    turbineHeightOffsetM: Number(env.VITE_TURBINE_HEIGHT_OFFSET_M ?? 0),
    turbineScale: Number(env.VITE_TURBINE_SCALE ?? 1),
  };
}
