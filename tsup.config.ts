import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/container/index.ts",
    signals: "src/signals/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: ["react"],
});
