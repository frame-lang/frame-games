import { defineConfig } from "vite";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, createReadStream } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
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
      // games/*/versions/godot-wasm/*.html and streams the file verbatim
      // (with the same COOP/COEP headers as the global server config) so
      // Godot's loader runs cleanly.
      name: "godot-html-passthrough",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (!req.url) return next();
          const url = req.url.split("?")[0];
          if (
            /^\/games\/[^/]+\/versions\/godot-wasm\//.test(url) &&
            url.endsWith(".html")
          ) {
            const filePath = join(__dirname, url);
            if (existsSync(filePath)) {
              res.setHeader("Content-Type", "text/html");
              res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
              res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
              createReadStream(filePath).pipe(res);
              return;
            }
          }
          next();
        });
      },
    },
  ],
});
