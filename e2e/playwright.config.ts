import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests',
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 1,
	workers: 1,
	reporter: 'html',
	timeout: 10_000,

	use: {
		baseURL: 'https://auth.localhost.test',
		ignoreHTTPSErrors: true,
		trace: 'on-first-retry',
	},

	projects: [
		{
			name: 'setup',
			testDir: '.',
			testMatch: /auth\.setup\.ts/,
			timeout: 30_000,
		},
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				storageState: 'e2e/.auth/admin.json',
			},
			dependencies: ['setup'],
		},
	],
});
