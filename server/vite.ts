// server/vite.ts
import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import {
  createServer as createViteServer,
  createLogger,
  loadConfigFromFile,
  mergeConfig,
  type InlineConfig,
} from "vite";
import { type Server } from "http";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

/** Small console helper used elsewhere */
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

/**
 * Dev-only: attach Vite in middleware mode to our Express app,
 * but **load the real vite.config.ts** so aliases/root match prod.
 */
export async function setupVite(app: Express, httpServer: Server) {
  const repoRoot = path.resolve(import.meta.dirname, "..");
  const clientRoot = path.resolve(repoRoot, "client");
  const configPath = path.resolve(repoRoot, "vite.config.ts");

  // Load the same config Vite CLI would load
  const loaded = await loadConfigFromFile(
    { mode: "development", command: "serve" },
    configPath,
    clientRoot,
  );
  const userConfig = (loaded?.config ?? {}) as InlineConfig;

  const vite = await createViteServer(
    mergeConfig(userConfig, {
      root: clientRoot,
      appType: "spa",
      customLogger: viteLogger, // keep normal logging; don't exit the process on errors
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
      },
    } as InlineConfig),
  );

  // Use Vite's middlewares
  app.use(vite.middlewares);

  // HTML fallback that transforms index.html (so HMR, env, aliases work)
  app.use("*", async (req, res, next) => {
    try {
      const url = req.originalUrl;

      const clientTemplate = path.resolve(clientRoot, "index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");

      // Cheap cache-bust for client entry during dev
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );

      const html = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

/**
 * Prod: serve the built client from dist/public (same as before).
 */
export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // SPA fallback
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
