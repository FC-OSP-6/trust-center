import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: [
      "server/**/*.test.ts",
      "testing/**/*.test.ts"
    ],
    environment: "node"
  }
})


