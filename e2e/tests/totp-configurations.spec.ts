import { test, expect } from '@playwright/test';

test.describe('TOTP Configurations', () => {
	test('should list TOTP configurations page', async ({ page }) => {
		await page.goto('/auth-admin/totp/configurations');
		await expect(page.locator('h2')).toContainText('TOTP Configurations');

		// Page should show either a table with configurations or an empty state
		const table = page.locator('table');
		const emptyState = page.locator('text=No TOTP configurations');
		await expect(table.or(emptyState)).toBeVisible();
	});
});
