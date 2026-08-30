import { defineConfig } from "vitest/config";
import path from "path";

// Separate test config: keeps the Enter dev/prod plugins out of the test
// pipeline while preserving the same "@" alias the app uses.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
