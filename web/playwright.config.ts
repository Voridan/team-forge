import { defineConfig, devices } from '@playwright/test';

const WEB_PORT = 5173;
const WEB_URL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // chat tests share team state — keep them serial
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Assumes the dev stack (api + realtime + web) is already running. Run
  // `./dev.sh && (cd web && npm run dev) &` in another terminal before
  // `npm run test:e2e`. CI would spin these up via docker compose first.
  webServer: process.env.CI
    ? {
        command: 'npm run dev',
        url: WEB_URL,
        reuseExistingServer: false,
        timeout: 60_000,
      }
    : undefined,
});
