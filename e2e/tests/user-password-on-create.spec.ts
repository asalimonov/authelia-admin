import { test, expect } from '@playwright/test';

/**
 * E2E tests for the bug: new user created via authelia-admin has wrong/no password in LLDAP.
 *
 * Regression test for: fix/new-user-password-not-set
 *
 * The bug: after creating a user through the UI the password from the form was never
 * forwarded to LLDAP via LDAP protocol (the TODO was left unimplemented). As a result
 * the new user was created with no usable password.
 *
 * These tests verify that after user creation:
 *   1. The UI creation flow succeeds and redirects to the user detail page.
 *   2. The password supplied in the form is actually accepted by LLDAP (verified by
 *      calling LLDAP's token endpoint with those credentials).
 *   3. Changing the password immediately after creation also works (ensures LDAP
 *      connectivity is healthy for the new user DN).
 */

const SUFFIX = Date.now().toString(36);
const TEST_USER_ID = `e2epwd${SUFFIX}`;
const TEST_USER_EMAIL = `e2epwd${SUFFIX}@localhost.test`;
const TEST_USER_DISPLAY = `E2E Password Test ${SUFFIX}`;
const TEST_USER_PASSWORD = 'E2eTestPass1!';
const LLDAP_BASE_URL = 'http://localhost:17170';

/** Obtain a JWT from LLDAP using username+password (verifies the password works). */
async function lldapLogin(username: string, password: string): Promise<{ ok: boolean; status: number }> {
	const response = await fetch(`${LLDAP_BASE_URL}/auth/simple/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, password })
	});
	return { ok: response.ok, status: response.status };
}

test.describe('User password is set correctly on creation', () => {
	test.describe.configure({ mode: 'serial' });

	let userDetailUrl: string;

	test('should create user via UI and redirect to user detail page', async ({ page }) => {
		await page.goto('/auth-admin/users/new');
		await expect(page.getByRole('heading', { name: 'Create New User' })).toBeVisible();

		await page.locator('#userId').fill(TEST_USER_ID);
		await page.locator('#email').fill(TEST_USER_EMAIL);
		await page.locator('#displayName').fill(TEST_USER_DISPLAY);
		await page.locator('#password').fill(TEST_USER_PASSWORD);
		await page.locator('#confirmPassword').fill(TEST_USER_PASSWORD);

		await page.locator('button[name="action"][value="create"]').click();

		// Should redirect to the new user's detail page (not stay on /new)
		await expect(page).toHaveURL(/\/users\/(?!new)[^/]+$/);
		userDetailUrl = page.url();

		// User ID should be visible on the detail page
		await expect(page.getByText(TEST_USER_ID, { exact: true })).toBeVisible();
	});

	test('password provided during creation must be accepted by LLDAP', async () => {
		// This is the core regression test: verifies the password was actually written
		// to LLDAP and is not empty/random.
		const result = await lldapLogin(TEST_USER_ID, TEST_USER_PASSWORD);
		expect(
			result.ok,
			`LLDAP rejected the password for newly created user "${TEST_USER_ID}". ` +
			`HTTP status: ${result.status}. ` +
			`This likely means the password was never forwarded to LLDAP after user creation.`
		).toBe(true);
	});

	test('wrong password should be rejected by LLDAP', async () => {
		// Sanity check: makes sure the positive test above is meaningful.
		const result = await lldapLogin(TEST_USER_ID, 'WrongPassword999!');
		expect(result.ok).toBe(false);
	});

	test('should be able to change the password via admin UI', async ({ page }) => {
		test.skip(!userDetailUrl, 'User was not created');
		await page.goto(userDetailUrl);

		// The password form is hidden behind a toggle button — click it first
		const changePasswordButton = page.getByRole('button', { name: /change password/i });
		await expect(changePasswordButton.first()).toBeVisible();
		await changePasswordButton.first().click();

		const newPassword = 'NewE2ePass2!';

		// After clicking, the form is revealed — wait for the fields to appear
		await expect(page.locator('#newPassword')).toBeVisible();
		await page.locator('#newPassword').fill(newPassword);
		await page.locator('#repeatPassword').fill(newPassword);

		// Submit — use the submit button inside the password form
		await page.locator('button[type="submit"]').click();

		// Expect a success notification
		await expect(page.locator('.bg-green-50')).toBeVisible();

		// Verify new password is accepted by LLDAP
		const result = await lldapLogin(TEST_USER_ID, newPassword);
		expect(result.ok).toBe(true);

		// Old password should now be rejected
		const oldResult = await lldapLogin(TEST_USER_ID, TEST_USER_PASSWORD);
		expect(oldResult.ok).toBe(false);
	});

	test('should delete the test user', async ({ page }) => {
		test.skip(!userDetailUrl, 'User was not created');
		await page.goto(userDetailUrl);

		await page.getByRole('button', { name: 'Delete' }).first().click();

		const modal = page.locator('.fixed.inset-0');
		await expect(modal).toBeVisible();
		await modal.locator('button[type="submit"]').click();

		await expect(page).toHaveURL(/\/users$/);
	});
});
