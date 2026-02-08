import { test, expect } from '@playwright/test';

const TEST_IP = '192.168.99.99';
const TEST_REASON = 'E2E test ban';

test.describe('Banned IP Lifecycle', () => {
	test.describe.configure({ mode: 'serial' });

	test('should list banned IPs page', async ({ page }) => {
		await page.goto('/auth-admin/banned/ip');
		await expect(page.locator('h2')).toContainText('Banned IP Addresses');
	});

	test('should add a banned IP', async ({ page }) => {
		await page.goto('/auth-admin/banned/ip');

		// Click the "Ban IP Address" button to show the form
		await page.getByRole('button', { name: 'Ban IP Address' }).click();

		// Form should be visible
		await expect(page.locator('#ip')).toBeVisible();

		// Fill in the form
		await page.locator('#ip').fill(TEST_IP);
		await page.locator('#source').selectOption('admin');
		await page.locator('input[name="permanent"]').check();
		await page.locator('#reason').fill(TEST_REASON);

		// Submit the form - click the submit button inside the add form
		await page.locator('.bg-gray-50 button[type="submit"]').click();

		// Wait for the page to update
		await page.waitForLoadState('networkidle');

		// Verify the IP appears in the table
		await expect(page.locator(`td:has-text("${TEST_IP}")`)).toBeVisible();
	});

	test('should remove the banned IP', async ({ page }) => {
		await page.goto('/auth-admin/banned/ip');

		// Find the row with our test IP
		const row = page.locator(`tr:has(td:has-text("${TEST_IP}"))`);
		await expect(row).toBeVisible();

		// Handle the confirm dialog
		page.on('dialog', async (dialog) => {
			await dialog.accept();
		});

		// Click the Delete button in that row
		await row.locator('button[type="submit"]').click();

		// Wait for the page to update
		await page.waitForLoadState('networkidle');

		// Verify the IP is no longer in the table
		await expect(page.locator(`td:has-text("${TEST_IP}")`)).not.toBeVisible();
	});
});
