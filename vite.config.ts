import { defineConfig } from "vite";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, createReadStream, cpSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

// GitHub Pages deploys under https://<org>.github.io/frame-games/, so the
// production build needs base="/frame-games/" for asset URLs. The dev
// server stays at root. Override with VITE_BASE if you deploy elsewhere
// (e.g. VITE_BASE=/ for a custom-domain build).
const PROD_BASE = process.env.VITE_BASE ?? "/frame-games/";

export default defineConfig(({ command }) => ({
  base: command === "build" ? PROD_BASE : "/",
  // Three pages: the games index, the per-game player, and the pop-out FSM
  // viewer (driven by BroadcastChannel from the player page).
  build: {
    // ES2022 so fsm-page.ts can use top-level await for the chart render.
    // Browser support: Chrome 89+, Firefox 89+, Safari 15+, Edge 89+.
    target: "es2022",
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        game: resolve(__dirname, "game.html"),
        fsm: resolve(__dirname, "fsm.html"),
      },
    },
  },
  server: {
    // Godot 4.x web exports use threads (SharedArrayBuffer), which the browser
    // only exposes under cross-origin isolation. These headers turn it on for
    // the whole dev server so the lazily-embedded Godot-WASM iframe can boot.
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  plugins: [
    {
      // Vite's HTML transformer normally injects `<script src="/@vite/client">`
      // into every served HTML. The Godot-WASM iframe is *not* a Vite page —
      // injecting that script collides with Godot's bootstrap and the canvas
      // stays grey forever. This middleware intercepts requests under
      // games/*/versions/<any-godot-variant>/*.html and streams the file
      // verbatim (with the same COOP/COEP headers as the global server config)
      // so Godot's loader runs cleanly. Matches every language bundle
      // (godot-gdscript / godot-rust / godot-cpp / godot-c), not just one.
      name: "godot-html-passthrough",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (!req.url) return next();
          const url = req.url.split("?")[0];
          const isBundle = /^\/games\/[^/]+\/versions\/[^/]+\//.test(url);
          const isHtml = url.endsWith(".html");
          // Flutter (Flame) bundles ship an ESM-flavoured flutter_bootstrap.js
          // loaded as a classic <script>; Vite's dev transform would inject an
          // `import` and break it ("Cannot use import statement outside a
          // module"). Stream every bundle .js/.mjs verbatim too — Godot's
          // classic IIFE loaders are unaffected (already served untransformed).
          const isJs = url.endsWith(".js") || url.endsWith(".mjs");
          if (isBundle && (isHtml || isJs)) {
            const filePath = join(__dirname, url);
            if (existsSync(filePath)) {
              res.setHeader(
                "Content-Type",
                isHtml ? "text/html" : "text/javascript",
              );
              if (isHtml) {
                res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
                res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
              }
              createReadStream(filePath).pipe(res);
              return;
            }
          }
          next();
        });
      },
    },
    {
      // Per-game static assets (article images, Godot WASM exports) live
      // under games/<id>/ but aren't bundled by Vite (article markdown's
      // <img src="/games/..."> URLs are static strings; the Godot iframe
      // src comes from game.json). Copy them into dist/ at build time so
      // the production site can serve them at the same paths.
      name: "copy-game-assets",
      apply: "build",
      closeBundle() {
        const src = resolve(__dirname, "games");
        const dst = resolve(__dirname, "dist/games");
        if (!existsSync(src)) return;
        cpSync(src, dst, {
          recursive: true,
          // Skip files that are already bundled by Vite via import.meta.glob:
          // article markdown is parsed inline; game.json drives manifest
          // metadata. Both ship inside the JS bundle, so they don't need a
          // second copy on disk.
          filter: (path) =>
            !path.endsWith(".md") && !path.endsWith("game.json"),
        });
      },
    },
  ],
}));
