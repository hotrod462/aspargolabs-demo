import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": root,
      "server-only": path.join(root, "tests/shims/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    setupFiles: [path.join(root, "tests/integration/dotenv-setup.ts")],
    fileParallelism: false,
    hookTimeout: 120_000,
    testTimeout: 120_000,
    include: ["tests/integration/**/*.integration.test.ts"],
  },
});
