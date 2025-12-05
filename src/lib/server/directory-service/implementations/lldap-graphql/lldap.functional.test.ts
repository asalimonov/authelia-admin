/**
 * Functional tests for LLDAPGraphQLService
 *
 * These tests run against a live LLDAP instance with bootstrap data.
 * Bootstrap users: admin, test, bind_user, user_manager, password_manager
 * Bootstrap groups: admins, users, cloud, cloud_main, disabled, lldap_admin, lldap_password_manager, lldap_strict_readonly
 *
 * Prerequisites:
 * - LLDAP running at ldap.localhost.test:17170
 * - Run `make docker-compose-run` to start the test environment
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { LLDAPGraphQLService } from './index';
import { LLDAPGraphQLClient } from './client';
import type { LLDAPGraphQLConfig } from '../../config';

// Test configuration - matches the LLDAP instance from docker-compose
// When running inside Docker network, use internal hostname 'lldap'
// When running from host, use 'ldap.localhost.test:17170' via Traefik
const testConfig: LLDAPGraphQLConfig = {
	type: 'lldap-graphql',
	endpoint: process.env.LLDAP_ENDPOINT || 'http://lldap:17170/api/graphql',
	user: 'admin',
	password: 'admin1234',
	// LDAP settings for password changes (LLDAP's GraphQL doesn't support password changes)
	ldap_host: 'lldap',
	ldap_port: 3890,
	ldap_base_dn: 'dc=localhost,dc=test'
};

// Disable TLS certificate verification for tests (self-signed cert)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

describe('LLDAPGraphQLService Functional Tests', () => {
	let service: LLDAPGraphQLService;

	beforeAll(() => {
		service = new LLDAPGraphQLService(testConfig);
	});

	afterAll(() => {
		// Clear token cache after tests
		LLDAPGraphQLClient.clearTokenCache();
	});

	describe('Connection', () => {
		it('should successfully connect to LLDAP', async () => {
			const result = await service.testConnection();
			expect(result.success).toBe(true);
			expect(result.error).toBeUndefined();
		});
	});

	describe('User Operations', () => {
		it('should list all users', async () => {
			const users = await service.listUsers();

			expect(users).toBeDefined();
			expect(Array.isArray(users)).toBe(true);
			expect(users.length).toBeGreaterThan(0);

			// Check for bootstrap users
			const userIds = users.map((u) => u.id);
			expect(userIds).toContain('admin');
			expect(userIds).toContain('test');
		});

		it('should get admin user details', async () => {
			const user = await service.getUserDetails('admin');

			expect(user).not.toBeNull();
			expect(user!.id).toBe('admin');
			expect(user!.email).toBe('admin@localhost.test');
			expect(user!.uuid).toBeDefined();
			expect(user!.creationDate).toBeInstanceOf(Date);
			expect(Array.isArray(user!.groups)).toBe(true);
			expect(Array.isArray(user!.attributes)).toBe(true);
		});

		it('should get test user details', async () => {
			const user = await service.getUserDetails('test');

			expect(user).not.toBeNull();
			expect(user!.id).toBe('test');
			expect(user!.email).toBe('test@localhost.test');
		});

		it('should return null for non-existent user', async () => {
			const user = await service.getUserDetails('nonexistent_user_xyz');
			expect(user).toBeNull();
		});

		it('should create, update, and delete a user', async () => {
			const testUserId = `functest_user_${Date.now()}`;

			// Create user
			const createdUser = await service.createUser({
				id: testUserId,
				email: `${testUserId}@example.com`,
				displayName: 'Functional Test User'
			});
			expect(createdUser).toBeDefined();
			expect(createdUser.id).toBe(testUserId);
			expect(createdUser.email).toBe(`${testUserId}@example.com`);
			expect(createdUser.displayName).toBe('Functional Test User');

			// Update user
			const updateResult = await service.updateUser({
				id: testUserId,
				displayName: 'Updated Functional Test User'
			});

			expect(updateResult.success).toBe(true);

			// Verify update
			const updatedUser = await service.getUserDetails(testUserId);
			expect(updatedUser).not.toBeNull();
			expect(updatedUser!.displayName).toBe('Updated Functional Test User');

			// Delete user
			const deleteResult = await service.deleteUser(testUserId);
			expect(deleteResult.success).toBe(true);

			// Verify deletion
			const deletedUser = await service.getUserDetails(testUserId);
			expect(deletedUser).toBeNull();
		});
	});

	describe('Group Operations', () => {
		it('should list all groups', async () => {
			const groups = await service.listGroups();

			expect(groups).toBeDefined();
			expect(Array.isArray(groups)).toBe(true);
			expect(groups.length).toBeGreaterThan(0);

			// Check for bootstrap groups
			const groupNames = groups.map((g) => g.displayName);
			expect(groupNames).toContain('admins');
			expect(groupNames).toContain('users');
			expect(groupNames).toContain('cloud');
		});

		it('should get group details by ID (uuid)', async () => {
			// First list groups to get IDs (now uuids)
			const groups = await service.listGroups();
			const adminsGroup = groups.find((g) => g.displayName === 'admins');

			expect(adminsGroup).toBeDefined();
			expect(typeof adminsGroup!.id).toBe('string'); // uuid is string

			const group = await service.getGroupDetails(adminsGroup!.id);

			expect(group).not.toBeNull();
			expect(group!.id).toBe(adminsGroup!.id); // id is uuid
			expect(group!.displayName).toBe('admins');
			expect(group!.creationDate).toBeInstanceOf(Date);
			expect(Array.isArray(group!.members)).toBe(true);
			expect(Array.isArray(group!.attributes)).toBe(true);
		});

		it('should return null for non-existent group', async () => {
			const group = await service.getGroupDetails('non-existent-uuid-12345');
			expect(group).toBeNull();
		});

		it('should create, update, and delete a group', async () => {
			const testGroupName = `functest_group_${Date.now()}`;

			// Create group
			const createdGroup = await service.createGroup({
				displayName: testGroupName
			});

			expect(createdGroup).toBeDefined();
			expect(createdGroup.displayName).toBe(testGroupName);
			expect(createdGroup.id).toBeDefined();
			expect(typeof createdGroup.id).toBe('string'); // id is uuid (string)

			const groupId = createdGroup.id; // uuid string

			// Update group
			const updateResult = await service.updateGroup({
				id: groupId,
				displayName: `${testGroupName}_updated`
			});

			expect(updateResult.success).toBe(true);

			// Verify update
			const updatedGroup = await service.getGroupDetails(groupId);
			expect(updatedGroup).not.toBeNull();
			expect(updatedGroup!.displayName).toBe(`${testGroupName}_updated`);

			// Delete group
			const deleteResult = await service.deleteGroup(groupId);
			expect(deleteResult.success).toBe(true);

			// Verify deletion
			const deletedGroup = await service.getGroupDetails(groupId);
			expect(deletedGroup).toBeNull();
		});
	});

	describe('Membership Operations', () => {
		let testUserId: string;
		let testGroupId: string;

		beforeAll(async () => {
			// Create a test user and group for membership tests
			testUserId = `membership_test_${Date.now()}`;
			const user = await service.createUser({
				id: testUserId,
				email: `${testUserId}@example.com`,
				displayName: 'Membership Test User'
			});
			expect(user.id).toBe(testUserId);

			const group = await service.createGroup({
				displayName: `membership_test_group_${Date.now()}`
			});
			testGroupId = group.id;
		});

		afterAll(async () => {
			// Cleanup - delete test user and group
			await service.deleteUser(testUserId);
			await service.deleteGroup(testGroupId);
		});

		it('should add user to group', async () => {
			const result = await service.addUserToGroup(testUserId, testGroupId);
			expect(result.success).toBe(true);

			// Verify membership
			const user = await service.getUserDetails(testUserId);
			expect(user).not.toBeNull();
			const groupIds = user!.groups.map((g) => g.id);
			expect(groupIds).toContain(testGroupId);
		});

		it('should remove user from group', async () => {
			const result = await service.removeUserFromGroup(testUserId, testGroupId);
			expect(result.success).toBe(true);

			// Verify removal
			const user = await service.getUserDetails(testUserId);
			expect(user).not.toBeNull();
			const groupIds = user!.groups.map((g) => g.id);
			expect(groupIds).not.toContain(testGroupId);
		});
	});

	describe('Schema Operations', () => {
		it('should get user attributes schema', async () => {
			const schema = await service.getUserAttributesSchema();

			expect(schema).toBeDefined();
			expect(Array.isArray(schema.attributes)).toBe(true);
			expect(schema.attributes.length).toBeGreaterThan(0);

			// Check schema structure
			const firstAttr = schema.attributes[0];
			expect(firstAttr.name).toBeDefined();
			expect(firstAttr.type).toBeDefined();
			expect(typeof firstAttr.isList).toBe('boolean');
			expect(typeof firstAttr.isVisible).toBe('boolean');
			expect(typeof firstAttr.isEditable).toBe('boolean');
			expect(typeof firstAttr.isReadonly).toBe('boolean');
		});

		it('should get group attributes schema', async () => {
			const schema = await service.getGroupAttributesSchema();

			expect(schema).toBeDefined();
			expect(Array.isArray(schema.attributes)).toBe(true);
		});
	});

	describe('Password Operations', () => {
		let testUserId: string;

		beforeAll(async () => {
			// Create a test user for password change tests
			testUserId = `password_test_${Date.now()}`;
			const user = await service.createUser({
				id: testUserId,
				email: `${testUserId}@example.com`,
				displayName: 'Password Test User'
			});
			expect(user.id).toBe(testUserId);
		});

		afterAll(async () => {
			// Restore token cache for admin service before cleanup
			LLDAPGraphQLClient.clearTokenCache();
			// Cleanup - delete test user
			await service.deleteUser(testUserId);
		});

		afterEach(() => {
			// Restore token cache after each test that might clear it
			// This ensures subsequent tests can use the admin service
			LLDAPGraphQLClient.clearTokenCache();
		});

		it('should change password for another user', async () => {
			const newPassword = 'NewSecurePassword123!';
			const result = await service.changePassword(testUserId, newPassword);

			// Log error for debugging if test fails
			if (!result.success) {
				console.error('Password change failed:', result.error);
			}

			expect(result.success).toBe(true);
			expect(result.error).toBeUndefined();
		});

		it('should verify password was changed by authenticating with new password', async () => {
			const newPassword = 'AnotherPassword456!';

			// First change the password
			const changeResult = await service.changePassword(testUserId, newPassword);
			expect(changeResult.success).toBe(true);

			// Verify by creating a new service instance with the test user's credentials
			// and attempting to connect
			const testUserConfig: LLDAPGraphQLConfig = {
				type: 'lldap-graphql',
				endpoint: testConfig.endpoint,
				user: testUserId,
				password: newPassword
			};

			const testUserService = new LLDAPGraphQLService(testUserConfig);
			const connectionResult = await testUserService.testConnection();

			expect(connectionResult.success).toBe(true);
		});

		it('should fail to change password for non-existent user', async () => {
			const result = await service.changePassword('nonexistent_user_xyz_12345', 'SomePassword123!');

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});

		it('should change password multiple times successfully', async () => {
			// Change password first time
			const firstPassword = 'FirstPassword123!';
			const firstResult = await service.changePassword(testUserId, firstPassword);
			expect(firstResult.success).toBe(true);

			// Clear token cache to force re-authentication with first password
			LLDAPGraphQLClient.clearTokenCache();

			// Verify first password works
			const firstConfig: LLDAPGraphQLConfig = {
				type: 'lldap-graphql',
				endpoint: testConfig.endpoint,
				user: testUserId,
				password: firstPassword
			};
			const firstService = new LLDAPGraphQLService(firstConfig);
			const firstConnection = await firstService.testConnection();
			expect(firstConnection.success).toBe(true);

			// Change password second time (need admin auth for this)
			LLDAPGraphQLClient.clearTokenCache();
			const secondPassword = 'SecondPassword456!';
			const secondResult = await service.changePassword(testUserId, secondPassword);
			expect(secondResult.success).toBe(true);

			// Clear token cache to force re-authentication with new password
			LLDAPGraphQLClient.clearTokenCache();

			// Verify second password works
			const secondConfig: LLDAPGraphQLConfig = {
				type: 'lldap-graphql',
				endpoint: testConfig.endpoint,
				user: testUserId,
				password: secondPassword
			};
			const secondService = new LLDAPGraphQLService(secondConfig);
			const secondConnection = await secondService.testConnection();
			expect(secondConnection.success).toBe(true);

			// Clear token cache and verify first password no longer works
			LLDAPGraphQLClient.clearTokenCache();
			const oldPasswordService = new LLDAPGraphQLService(firstConfig);
			const oldPasswordConnection = await oldPasswordService.testConnection();
			expect(oldPasswordConnection.success).toBe(false);
		});
	});

	describe('Bootstrap Data Verification', () => {
		it('should verify admin user is in admins group', async () => {
			const user = await service.getUserDetails('admin');
			expect(user).not.toBeNull();

			const groupNames = user!.groups.map((g) => g.displayName);
			expect(groupNames).toContain('admins');
		});

		it('should verify test user is in cloud group', async () => {
			const user = await service.getUserDetails('test');
			expect(user).not.toBeNull();

			const groupNames = user!.groups.map((g) => g.displayName);
			expect(groupNames).toContain('cloud');
		});

		it('should verify admins group has admin user as member', async () => {
			const groups = await service.listGroups();
			const adminsGroup = groups.find((g) => g.displayName === 'admins');
			expect(adminsGroup).toBeDefined();

			const group = await service.getGroupDetails(adminsGroup!.id);
			expect(group).not.toBeNull();

			const memberIds = group!.members.map((m) => m.id);
			expect(memberIds).toContain('admin');
		});
	});
});
