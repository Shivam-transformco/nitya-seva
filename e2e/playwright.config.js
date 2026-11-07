import { defineConfig } from "@playwright/test";
import { API_URL, WEB_PORT, WEB_URL, serverEnv } from "./env.js";

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.js",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: WEB_URL,
    channel: process.env.E2E_BROWSER_CHANNEL ?? "chrome",
    timezoneId: "Asia/Kolkata",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "npx tsx src/dev.ts",
      cwd: "../server",
      url: `${API_URL}/api/stats`,
      env: serverEnv,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      cwd: "../client",
      url: WEB_URL,
      env: { VITE_API_URL: API_URL },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
