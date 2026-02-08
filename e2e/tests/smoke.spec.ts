import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
	test('should load the dashboard page', async ({ page }) => {
		await page.goto('/auth-admin/');
		await expect(page.locator('h2')).toContainText('Welcome to Authelia Admin');
	});

	test('should load the users page', async ({ page }) => {
		await page.goto('/auth-admin/users');
		await expect(page.locator('h2')).toContainText('Users');
	});

	test('should load the groups page', async ({ page }) => {
		await page.goto('/auth-admin/groups');
		await expect(page.locator('h2')).toContainText('Groups');
	});

	test('should load the TOTP configurations page', async ({ page }) => {
		await page.goto('/auth-admin/totp/configurations');
		await expect(page.locator('h2')).toContainText('TOTP Configurations');
	});

	test('should load the TOTP history page', async ({ page }) => {
		await page.goto('/auth-admin/totp/history');
		await expect(page.locator('h2')).toContainText('TOTP History');
	});

	test('should load the banned users page', async ({ page }) => {
		await page.goto('/auth-admin/banned/users');
		await expect(page.locator('h2')).toContainText('Banned Users');
	});

	test('should load the banned IPs page', async ({ page }) => {
		await page.goto('/auth-admin/banned/ip');
		await expect(page.locator('h2')).toContainText('Banned IP Addresses');
	});

	test('should load the notifications page', async ({ page }) => {
		await page.goto('/auth-admin/notifications/file');
		// Page shows either the notifications content or "not configured" warning
		// Both are valid - just check the page loaded without error
		const heading = page.locator('h2');
		const warning = page.locator('.bg-yellow-50');
		await expect(heading.or(warning)).toBeVisible();
	});
});
