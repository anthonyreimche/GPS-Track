import { defineConfig } from "vitest/config";

// Classic JSX bound to the `React` binding each module imports from ./rt — the
// host's React instance, never a bundled one.
const JSX = { runtime: "classic", pragma: "React.createElement", pragmaFrag: "React.Fragment" } as const;

export default defineConfig({
  oxc: { jsx: JSX },
  build: {
    lib: { entry: "src/index.tsx", formats: ["es"], fileName: "index" },
    rollupOptions: { external: ["react", "react-dom"] },
    outDir: "dist",
    sourcemap: true,
  },
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    environment: "jsdom",
  },
});
