import { createReadStream, cpSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "node_modules/cesium/Build/Cesium");
const directories = ["Workers", "ThirdParty", "Assets", "Widgets"];
const mime = { ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg" };

export function cesiumStaticPlugin() {
  return {
    name: "cesium-static-assets",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!request.url?.startsWith("/cesiumStatic/")) return next();
        let path;
        try {
          path = resolve(source, decodeURIComponent(request.url.split("?")[0].slice("/cesiumStatic/".length)));
          const inside = relative(source, path);
          if (inside.startsWith("..") || inside.includes(`..${sep}`) || !directories.some((directory) => inside === directory || inside.startsWith(`${directory}${sep}`))) {
            response.writeHead(403).end();
            return;
          }
          const stats = statSync(path);
          if (!stats.isFile()) return next();
        } catch {
          return next();
        }
        response.setHeader("Content-Type", mime[extname(path).toLowerCase()] ?? "application/octet-stream");
        createReadStream(path).pipe(response);
      });
    },
    // Knockout (bundled in @cesium/widgets) finds the global object with (0,eval)("this"),
    // which the site's CSP blocks. globalThis does the same without eval.
    transform(code, id) {
      if (!id.includes("knockout") || !code.includes('(0,eval)("this")')) return null;
      return { code: code.replaceAll('(0,eval)("this")', "globalThis"), map: null };
    },
    writeBundle(options) {
      const output = options.dir ?? dirname(options.file);
      for (const directory of directories) {
        cpSync(join(source, directory), join(output, "cesiumStatic", directory), { recursive: true });
      }
    },
  };
}
