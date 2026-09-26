import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const page = (file: string) => fileURLToPath(new URL(file, import.meta.url));

// Two pages: the Encore game (index.html) and the classic piano studio (studio.html).
export default defineConfig({
  base: "./",
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: { input: { main: page("./index.html"), studio: page("./studio.html") } },
  },
});
