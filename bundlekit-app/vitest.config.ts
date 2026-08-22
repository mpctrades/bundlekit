import { defineConfig } from "vitest/config";

// Deliberately separate from vite.config.ts: the pricing core must be testable
// without booting the React Router app. Pure functions, no server.
export default defineConfig({
  test: {
    environment: "node",
    include: ["app/lib/**/*.test.ts", "extensions/**/*.test.js"],
  },
});
