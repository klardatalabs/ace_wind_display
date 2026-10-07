import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const API = process.env.API_ORIGIN || "http://localhost:4100";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@shared": fileURLToPath(new URL("../shared", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": API,
      "/ws": { target: API.replace(/^http/, "ws"), ws: true },
    },
    fs: { allow: [".."] },
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three")) return "three";
          if (id.includes("node_modules/gsap") || id.includes("lenis")) return "motion";
        },
      },
    },
  },
});
