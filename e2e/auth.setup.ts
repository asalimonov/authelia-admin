import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(__dirname, '.auth/admin.json');

setup('authenticate as admin', async ({ page }) => {
	// Ensure .auth directory exists
	fs.mkdirSync(path.dirname(authFile), { recursive: true });

	// Navigate to Authelia login page
	await page.goto('https://auth.localhost.test/');

	// Fill login form
	await page.locator('#username-textfield').fill('admin');
	await page.locator('#password-textfield').fill('admin1234');

	// Submit
	await page.locator('#sign-in-button').click();

	// Wait for Authelia to authenticate and redirect to /auth-admin/
	// (default_redirection_url in Authelia config is https://auth.localhost.test/auth-admin)
	await page.waitForURL('**/auth-admin/**', {
		timeout: 15_000,
	});

	// Verify dashboard loaded (check for "Welcome" heading)
	await expect(page.locator('h2')).toContainText('Welcome', {
		timeout: 10_000,
	});

	// Save authenticated state
	await page.context().storageState({ path: authFile });
});
