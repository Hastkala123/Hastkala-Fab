import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": fromRoot("./src"),
      // `import "server-only"` throws outside a React Server Component build;
      // tests run on the server, so stub it out.
      "server-only": fromRoot("./tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Integration tests share one test database, so files run one at a time.
    fileParallelism: false,
  },
});
