// server/vite.ts
import express from "express";
import fsSync from "fs";
import fs from "fs/promises";
import path from "path";
import { createServer as createViteServer, createLogger, loadConfigFromFile, mergeConfig, } from "vite";
import { nanoid } from "nanoid";
const viteLogger = createLogger();
export function log(message, source = "express") {
    const t = new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
    });
    console.log(`${t} [${source}] ${message}`);
}
/**
 * Dev-only: attach Vite as middleware *using the real vite.config.ts*
 * so aliases/root match production. Also force host/allowedHosts in case
 * the preview domain is random (Replit).
 */
export async function setupVite(app, httpServer) {
    const repoRoot = path.resolve(import.meta.dirname, "..");
    const clientRoot = path.resolve(repoRoot, "client");
    const configPath = path.resolve(repoRoot, "vite.config.ts");
    const loaded = await loadConfigFromFile({ mode: "development", command: "serve" }, configPath, clientRoot);
    const userConfig = (loaded?.config ?? {});
    const vite = await createViteServer(mergeConfig(userConfig, {
        root: clientRoot,
        appType: "spa",
        customLogger: viteLogger,
        server: {
            ...(userConfig.server ?? {}),
            middlewareMode: true,
            host: true, // <- ensure binds properly behind proxy
            allowedHosts: true, // <- allow replit preview host
            hmr: { server: httpServer },
        },
    }));
    // Vite middlewares first
    app.use(vite.middlewares);
    // SPA index transform (so HMR/env work)
    app.use("*", async (req, res, next) => {
        try {
            const url = req.originalUrl;
            const indexPath = path.resolve(clientRoot, "index.html");
            let template = await fs.readFile(indexPath, "utf-8");
            // cheap cache-bust for the entry during dev
            template = template.replace(`src="/src/main.tsx"`, `src="/src/main.tsx?v=${nanoid()}"`);
            const html = await vite.transformIndexHtml(url, template);
            res.status(200).type("html").end(html);
        }
        catch (e) {
            vite.ssrFixStacktrace(e);
            next(e);
        }
    });
}
/**
 * Production: serve built client from /dist/public (your build copies here).
 */
export function serveStatic(app) {
    const distPath = path.resolve(import.meta.dirname, "public");
    if (!fsSync.existsSync(distPath)) {
        throw new Error(`Could not find the build directory: ${distPath}. Run the client build first.`);
    }
    app.use(express.static(distPath));
    // SPA fallback
    app.use("*", (_req, res) => {
        res.sendFile(path.resolve(distPath, "index.html"));
    });
}
