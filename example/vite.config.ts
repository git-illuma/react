import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const dist = (file: string) => fileURLToPath(new URL(`../dist/${file}`, import.meta.url));

/**
 * No React plugin: Vite transforms `.tsx` with esbuild and takes the automatic
 * JSX runtime from this directory's tsconfig, so the plugin would only add Fast
 * Refresh.
 *
 * The aliases exist because neither `@illuma/react-experimental` nor its peer
 * `@illuma/signals` is published yet, so this example cannot install the
 * adapter the way you will. They point at the package's real build output and
 * keep its `exports` map honest — `dist/index.js`, `dist/signals.js` and
 * `dist/testkit.js` are the three entry points an installed consumer gets.
 * Run `bun run build` in the package root before `bun run dev`.
 *
 * Copying this example into a project of your own? Delete the `resolve` block.
 * Everything else stands as written.
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: "@illuma/react-experimental/testkit", replacement: dist("testkit.js") },
      { find: "@illuma/react-experimental/signals", replacement: dist("signals.js") },
      { find: "@illuma/react-experimental", replacement: dist("index.js") },
    ],
  },
  server: { port: 5175, open: false },
  build: { outDir: "dist", emptyOutDir: true },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.spec.tsx"],
  },
});
