import { defineConfig } from "vitest/config";

// Two projects:
// - spec: every test in spec/ runs against the RUNNING app, which
//   spec/global-setup.ts finds (the course harness).
// - unit: test/ checks pure code and data (roster, skill engine) with no
//   server needed.
export default defineConfig({
  test: {
    projects: [
      { test: { name: "spec", include: ["spec/**/*.test.ts"], globalSetup: ["./spec/global-setup.ts"] } },
      { test: { name: "unit", include: ["test/**/*.test.ts"] } },
    ],
  },
});
