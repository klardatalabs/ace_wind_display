// Renders the landing page's 3D stills (frontend/public/images/renders/*.jpg) from the
// real TurbineScene, so the website shows the same turbine as the hoardings without
// shipping WebGL on the landing page.
//
// Usage: npm run build && npm start   (in another terminal)
//        node scripts/render-stills.mjs [http://localhost:4100]
// Needs Playwright (npx playwright install chromium) or PLAYWRIGHT_BROWSERS_PATH set.

import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// PLAYWRIGHT_MODULE lets you point at a globally installed copy.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright").catch(() => {
  console.error("Playwright is required: npm i -D playwright && npx playwright install chromium");
  process.exit(1);
});

const BASE = process.argv[2] || "http://localhost:4100";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "frontend", "public", "images", "renders");

// name, theme, steps to run on the scene, extra settle time
const STILLS = [
  { name: "turbine-hero", theme: "cartoon", steps: [["shot", "hero"]] },
  { name: "turbine-inside", theme: "blueprint", steps: [["open"], ["shot", "nacelle"]], settle: 4000 },
  { name: "turbine-nacelle", theme: "realistic", steps: [["shot", "nacelle"]] },
  { name: "turbine-base", theme: "realistic", steps: [["open"], ["shot", "base"]], settle: 4000 },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

for (const still of STILLS) {
  const page = await browser.newPage({ viewport: { width: 800, height: 1024 }, deviceScaleFactor: 2 });
  // The college screen has no scan; theme is switched in-page so nothing heavy loads.
  await page.goto(`${BASE}/screen/college?debug`);
  await page.waitForFunction(() => window.__scene?.lookInside, null, { timeout: 60_000 });
  await page.addStyleTag({ content: "body * { visibility: hidden !important } canvas { visibility: visible !important }" });
  await page.evaluate(async ({ theme, steps }) => {
    const scene = window.__scene;
    scene.useSplat = false;
    scene.frameShift = 0;
    scene.camera.clearViewOffset(); // centred framing for portrait cards
    scene.camera.updateProjectionMatrix();
    scene.setLive({ rotorRpm: 0, nacelleDeg: 215 }); // still blades for a crisp picture
    scene.setTheme(theme);
    scene.commandToken++; // cancel the story's own camera move
    for (const [kind, arg] of steps) {
      if (kind === "shot") scene.rig.jumpTo(arg);
      else if (kind === "open") scene.lookInside.open(0.2); // cutaway + x-ray + peel, no fly-in
      else scene.command(arg);
    }
  }, still);
  await page.waitForTimeout(still.settle ?? 3000);
  const file = path.join(OUT, `${still.name}.jpg`);
  await page.locator("canvas").screenshot({ path: file, type: "jpeg", quality: 82 });
  console.log("wrote", path.relative(process.cwd(), file));
  await page.close();
}
await browser.close();
