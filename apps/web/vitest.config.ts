import path from "node:path"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@mordonezdev/logokit-core": path.resolve(__dirname, "../../packages/core/src/index.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
})
