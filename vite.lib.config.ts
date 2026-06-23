import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  publicDir: false,
  build: {
    outDir: "dist/lib",
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: {
        "nix-js-auth": resolve("src/index.ts"),
        "command": resolve("src/command.ts"),
      },
      name: "NixJsAuth",
      formats: ["es", "cjs"],
      fileName: (format, entryName) =>
        `${entryName}.${format === "cjs" ? "cjs" : "js"}`,
    },
    rollupOptions: {
      external: ["@deijose/nix-js", "@deijose/nix-query"],
      output: {
        preserveModules: false,
        globals: {
          "@deijose/nix-js": "NixJs",
        },
      },
    },
  },
});
