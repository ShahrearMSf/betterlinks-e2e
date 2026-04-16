const { defineConfig } = require('@playwright/test');
require('dotenv').config();

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  reporter: [['html', { open: 'never' }], ['list']],
  globalSetup: require.resolve('./helpers/global-setup.js'),
  globalTeardown: require.resolve('./helpers/global-teardown.js'),
  use: {
    baseURL: process.env.BASE_URL,
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'on-first-retry',
    actionTimeout: 30000,
    navigationTimeout: 60000,
  },
  projects: [
    {
      name: 'auth-setup',
      testMatch: /auth\.setup\.js/,
    },
    {
      name: 'free',
      testDir: './tests/free',
      dependencies: ['auth-setup'],
      use: {
        storageState: 'playwright/.auth/admin.json',
      },
    },
    {
      name: 'pro',
      testDir: './tests/pro',
      dependencies: ['auth-setup'],
      use: {
        storageState: 'playwright/.auth/admin.json',
      },
    },
  ],
});
