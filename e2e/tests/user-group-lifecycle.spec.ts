import { test, expect } from '@playwright/test';

// Use timestamp suffix to ensure unique names across test runs and retries
const SUFFIX = Date.now().toString(36);
const TEST_GROUP_NAME = `E2E Group ${SUFFIX}`;
const TEST_USER_ID = `e2e${SUFFIX}`;
const TEST_USER_EMAIL = `e2e${SUFFIX}@localhost.test`;
const TEST_USER_DISPLAY = `E2E User ${SUFFIX}`;
const TEST_USER_PASSWORD = 'TestPass123';

test.describe('User & Group Lifecycle', () => {
	test.describe.configure({ mode: 'serial' });

	let groupDetailUrl: string;
	let userDetailUrl: string;

	test('should list groups', async ({ page }) => {
		await page.goto('/auth-admin/groups');
		await expect(page.locator('h2')).toContainText('Groups');
		// Table should be visible (bootstrap creates default groups)
		await expect(page.locator('table')).toBeVisible();
	});

	test('should create a new group', async ({ page }) => {
		await page.goto('/auth-admin/groups/new');
		await expect(page.getByRole('heading', { name: 'Create New Group' })).toBeVisible();

		// Fill in group name
		await page.locator('#displayName').fill(TEST_GROUP_NAME);

		// Click "Create" button
		await page.locator('button[name="action"][value="create"]').click();

		// Wait for redirect to group detail page - URL should contain a UUID, not "/new"
		await expect(page).toHaveURL(/\/groups\/(?!new)[^/]+$/);
		groupDetailUrl = page.url();

		// Verify group info is displayed
		await expect(page.getByText(TEST_GROUP_NAME)).toBeVisible();
	});

	test('should list users', async ({ page }) => {
		await page.goto('/auth-admin/users');
		await expect(page.locator('h2')).toContainText('Users');
		// Table should be visible (bootstrap creates default users)
		await expect(page.locator('table')).toBeVisible();
	});

	test('should create a new user', async ({ page }) => {
		await page.goto('/auth-admin/users/new');
		await expect(page.getByRole('heading', { name: 'Create New User' })).toBeVisible();

		// Fill in user form
		await page.locator('#userId').fill(TEST_USER_ID);
		await page.locator('#email').fill(TEST_USER_EMAIL);
		await page.locator('#displayName').fill(TEST_USER_DISPLAY);
		await page.locator('#password').fill(TEST_USER_PASSWORD);
		await page.locator('#confirmPassword').fill(TEST_USER_PASSWORD);

		// Click "Create" button
		await page.locator('button[name="action"][value="create"]').click();

		// Wait for redirect to user detail page - URL should contain the user ID
		await expect(page).toHaveURL(/\/users\/(?!new)[^/]+$/);
		userDetailUrl = page.url();

		// Verify user info is displayed
		await expect(page.getByText(TEST_USER_ID, { exact: true })).toBeVisible();
	});

	test('should add user to group', async ({ page }) => {
		// Navigate to the group detail page
		test.skip(!groupDetailUrl, 'Group was not created');
		await page.goto(groupDetailUrl);

		// The "Available Users" section has a heading - find the section after it
		const availableHeading = page.getByRole('heading', { name: 'Available Users' });
		await expect(availableHeading).toBeVisible();

		// Find our test user row in the available users table (last table on the page)
		const availableTable = page.locator('table').last();
		const userRow = availableTable.locator(`tr:has(a:text("${TEST_USER_ID}"))`);
		await expect(userRow).toBeVisible();

		// Click the Add button in that row
		await userRow.locator('button[type="submit"]').click();

		// Wait for the page to update - the user should now appear in members
		await page.waitForLoadState('networkidle');

		// Verify user is now in the members section (first table)
		const membersTable = page.locator('table').first();
		await expect(membersTable.locator(`a:text("${TEST_USER_ID}")`)).toBeVisible();
	});

	test('should remove user from group', async ({ page }) => {
		test.skip(!groupDetailUrl, 'Group was not created');
		await page.goto(groupDetailUrl);

		// Find the test user in the members table
		const memberRow = page.locator('table').first().locator(`tr:has(a:text("${TEST_USER_ID}"))`);
		await expect(memberRow).toBeVisible();

		// Click the Remove button
		await memberRow.locator('button[type="submit"]').click();

		// Wait for the success message to confirm the action completed
		await expect(page.locator('.bg-green-50')).toBeVisible();

		// Reload to get fresh data
		await page.reload();

		// After removing the only member, the members section should show "no members" text
		await expect(page.getByText('This group has no members')).toBeVisible();
	});

	test('should delete the user', async ({ page }) => {
		test.skip(!userDetailUrl, 'User was not created');
		await page.goto(userDetailUrl);

		// Click the Delete button to open modal
		await page.getByRole('button', { name: 'Delete' }).first().click();

		// Confirm in the modal
		const modal = page.locator('.fixed.inset-0');
		await expect(modal).toBeVisible();
		await modal.locator('button[type="submit"]').click();

		// Should redirect to users list (wait for URL change via polling)
		await expect(page).toHaveURL(/\/users$/);
	});

	test('should delete the group', async ({ page }) => {
		test.skip(!groupDetailUrl, 'Group was not created');
		await page.goto(groupDetailUrl);

		// Click the Delete button to open modal
		await page.getByRole('button', { name: 'Delete' }).first().click();

		// Confirm in the modal
		const modal = page.locator('.fixed.inset-0');
		await expect(modal).toBeVisible();
		await modal.locator('button[type="submit"]').click();

		// Should redirect to groups list (wait for URL change via polling)
		await expect(page).toHaveURL(/\/groups$/);

		// Verify group is no longer in the list
		await expect(page.getByText(TEST_GROUP_NAME)).not.toBeVisible();
	});
});
