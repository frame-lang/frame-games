import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  // Two pages: the games index and the per-game player.
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        game: resolve(__dirname, "game.html"),
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
});
