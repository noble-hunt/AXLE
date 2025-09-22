import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig(async ({ mode }) => {
  const root = path.resolve(import.meta.dirname, "client");

  // Replit dev-only plugins
  const plugins = [react(), runtimeErrorOverlay()];
  if (mode !== "production" && process.env.REPL_ID) {
    const { cartographer } = await import("@replit/vite-plugin-cartographer");
    const { devBanner } = await import("@replit/vite-plugin-dev-banner");
    plugins.push(cartographer(), devBanner());
  }

  return {
    // --- important for Vercel SPA deploy ---
    root, // app source lives in /client
    appType: "spa", // force SPA behavior
    base: "/", // correct asset URLs on Vercel
    publicDir: path.resolve(import.meta.dirname, "public"), // repo-root /public
    build: {
      outDir: path.resolve(import.meta.dirname, "dist"), // dist/index.html (SPA)
      emptyOutDir: true,
    },
    // ---------------------------------------

    plugins,
    resolve: {
      alias: {
        "@": path.resolve(root, "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    server: {
      /** Allow Replit’s random preview hostnames */
      allowedHosts: true,
      /** Bind on all interfaces; helps HMR behind proxies */
      host: true,
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
