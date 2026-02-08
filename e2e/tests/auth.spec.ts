import { test, expect } from '@playwright/test';

// This test file uses fresh browser context (no saved auth)
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Authentication', () => {
	test('should show 403 when accessing without auth', async ({ page }) => {
		const response = await page.goto('/auth-admin/');
		// App returns 403 for unauthenticated requests
		expect(response).not.toBeNull();
		expect(response!.status()).toBe(403);
		// Should show error page with status code
		await expect(page.locator('h1')).toContainText('403');
	});

	test('should authenticate via Authelia and access admin', async ({ page }) => {
		// Go to Authelia login
		await page.goto('https://auth.localhost.test/');
		// Login
		await page.locator('#username-textfield').fill('admin');
		await page.locator('#password-textfield').fill('admin1234');
		await page.locator('#sign-in-button').click();
		// Wait for Authelia to authenticate and redirect to /auth-admin/
		await page.waitForURL('**/auth-admin/**', {
			timeout: 15_000,
		});
		// Verify dashboard
		await expect(page.locator('h2')).toContainText('Welcome to Authelia Admin');
	});
});
