/**
 * Functional tests for AccessService with LLDAP
 *
 * These tests run against a live LLDAP instance with bootstrap data.
 * Bootstrap users: admin, test, usermanager, passwordmanager
 * Bootstrap groups: admins, users, cloud, cloud_main, disabled, lldap_admin, lldap_password_manager, authelia_user_manager
 *
 * Prerequisites:
 * - LLDAP running at lldap:17170
 * - Run `make docker-compose-run` to start the test environment
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LLDAPGraphQLService } from '../directory-service/implementations/lldap-graphql';
import { LLDAPGraphQLClient } from '../directory-service/implementations/lldap-graphql/client';
import type { LLDAPGraphQLConfig } from '../directory-service/config';
import { AccessService } from './access-service';
import { LLDAPRoleMapper } from './role-mapper';
import { Role, Permission, EntityType } from './types';

// Test configuration - matches the LLDAP instance from docker-compose
const testConfig: LLDAPGraphQLConfig = {
    type: 'lldap-graphql',
    endpoint: process.env.LLDAP_ENDPOINT || 'http://lldap:17170/api/graphql',
    user: 'admin',
    password: 'admin1234',
};

// Disable TLS certificate verification for tests (self-signed cert)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

describe('AccessService Functional Tests', () => {
    let directoryService: LLDAPGraphQLService;
    let accessService: AccessService;

    beforeAll(() => {
        directoryService = new LLDAPGraphQLService(testConfig);
        const roleMapper = new LLDAPRoleMapper();
        accessService = new AccessService(directoryService, roleMapper);
    });

    afterAll(() => {
        LLDAPGraphQLClient.clearTokenCache();
    });

    describe('Role Resolution', () => {
        it('should resolve admin user to ADMIN role', async () => {
            const role = await accessService.getUserRole('admin');
            expect(role).toBe(Role.ADMIN);
        });

        it('should resolve usermanager to USER_MANAGER role', async () => {
            const role = await accessService.getUserRole('usermanager');
            expect(role).toBe(Role.USER_MANAGER);
        });

        it('should resolve passwordmanager to PASSWORD_MANAGER role', async () => {
            const role = await accessService.getUserRole('passwordmanager');
            expect(role).toBe(Role.PASSWORD_MANAGER);
        });

        it('should resolve test user to null (no role)', async () => {
            const role = await accessService.getUserRole('test');
            expect(role).toBeNull();
        });

        it('should resolve non-existent user to null (no role, no permissions)', async () => {
            const role = await accessService.getUserRole('nonexistent_user_xyz');
            expect(role).toBeNull();

            // Non-existent users have no role and empty permissions
            const context = await accessService.getUserContext('nonexistent_user_xyz');
            expect(context.role).toBeNull();
            expect(context.permissions).toEqual([]);
        });
    });

    describe('User Context', () => {
        it('should return full context for admin user', async () => {
            const context = await accessService.getUserContext('admin');

            expect(context.userId).toBe('admin');
            expect(context.role).toBe(Role.ADMIN);
            expect(context.groups.length).toBeGreaterThan(0);
            expect(context.permissions.length).toBeGreaterThan(0);
        });

        it('should return context with correct groups for usermanager', async () => {
            const context = await accessService.getUserContext('usermanager');

            expect(context.userId).toBe('usermanager');
            expect(context.role).toBe(Role.USER_MANAGER);
            expect(context.groups).toContain('authelia_user_manager');
        });
    });

    describe('Protected Groups', () => {
        it('should identify lldap_admin as protected', () => {
            expect(accessService.isProtectedGroup('lldap_admin')).toBe(true);
        });

        it('should identify lldap_password_manager as protected', () => {
            expect(accessService.isProtectedGroup('lldap_password_manager')).toBe(true);
        });

        it('should identify authelia_user_manager as protected', () => {
            expect(accessService.isProtectedGroup('authelia_user_manager')).toBe(true);
        });

        it('should not identify users group as protected', () => {
            expect(accessService.isProtectedGroup('users')).toBe(false);
        });

        it('should not identify cloud group as protected', () => {
            expect(accessService.isProtectedGroup('cloud')).toBe(false);
        });
    });

    describe('Protected Users', () => {
        it('should identify admin as protected', async () => {
            const isProtected = await accessService.isUserProtected('admin');
            expect(isProtected).toBe(true);
        });

        it('should not identify test user as protected', async () => {
            const isProtected = await accessService.isUserProtected('test');
            expect(isProtected).toBe(false);
        });
    });

    describe('Permission Checks - Users without role', () => {
        const userId = 'test'; // test user has no role (not in any role group)

        it('should deny USER_LIST', async () => {
            const result = await accessService.check(userId, Permission.USER_LIST, EntityType.NONE);
            expect(result).toBe(false);
        });

        it('should deny USER_VIEW', async () => {
            const result = await accessService.check(
                userId,
                Permission.USER_VIEW,
                EntityType.USER,
                'admin'
            );
            expect(result).toBe(false);
        });

        it('should deny GROUP_LIST', async () => {
            const result = await accessService.check(
                userId,
                Permission.GROUP_LIST,
                EntityType.NONE
            );
            expect(result).toBe(false);
        });

        it('should deny USER_CREATE', async () => {
            const result = await accessService.check(
                userId,
                Permission.USER_CREATE,
                EntityType.NONE
            );
            expect(result).toBe(false);
        });

        it('should deny USER_CHANGE_PASSWORD', async () => {
            const result = await accessService.check(
                userId,
                Permission.USER_CHANGE_PASSWORD,
                EntityType.USER,
                'test'
            );
            expect(result).toBe(false);
        });
    });

    describe('Permission Checks - PASSWORD_MANAGER', () => {
        const userId = 'passwordmanager';

        it('should allow USER_CHANGE_PASSWORD for non-protected user', async () => {
            const result = await accessService.check(
                userId,
                Permission.USER_CHANGE_PASSWORD,
                EntityType.USER,
                'test'
            );
            expect(result).toBe(true);
        });

        it('should deny USER_CHANGE_PASSWORD for protected user (admin)', async () => {
            const result = await accessService.check(
                userId,
                Permission.USER_CHANGE_PASSWORD,
                EntityType.USER,
                'admin'
            );
            expect(result).toBe(false);
        });

        it('should deny USER_CREATE', async () => {
            const result = await accessService.check(
                userId,
                Permission.USER_CREATE,
                EntityType.NONE
            );
            expect(result).toBe(false);
        });
    });

    describe('Permission Checks - USER_MANAGER', () => {
        const userId = 'usermanager';

        it('should allow USER_CREATE', async () => {
            const result = await accessService.check(
                userId,
                Permission.USER_CREATE,
                EntityType.NONE
            );
            expect(result).toBe(true);
        });

        it('should allow USER_EDIT for non-protected user', async () => {
            const result = await accessService.check(
                userId,
                Permission.USER_EDIT,
                EntityType.USER,
                'test'
            );
            expect(result).toBe(true);
        });

        it('should deny USER_EDIT for protected user', async () => {
            const result = await accessService.check(
                userId,
                Permission.USER_EDIT,
                EntityType.USER,
                'admin'
            );
            expect(result).toBe(false);
        });

        it('should deny GROUP_CREATE', async () => {
            const result = await accessService.check(
                userId,
                Permission.GROUP_CREATE,
                EntityType.NONE
            );
            expect(result).toBe(false);
        });
    });

    describe('Permission Checks - ADMIN', () => {
        const userId = 'admin';

        it('should allow all user operations on protected users', async () => {
            expect(
                await accessService.check(userId, Permission.USER_EDIT, EntityType.USER, 'admin')
            ).toBe(true);
            expect(
                await accessService.check(userId, Permission.USER_DELETE, EntityType.USER, 'admin')
            ).toBe(true);
            expect(
                await accessService.check(
                    userId,
                    Permission.USER_CHANGE_PASSWORD,
                    EntityType.USER,
                    'admin'
                )
            ).toBe(true);
        });

        it('should allow GROUP_CREATE', async () => {
            const result = await accessService.check(
                userId,
                Permission.GROUP_CREATE,
                EntityType.NONE
            );
            expect(result).toBe(true);
        });

        it('should allow GROUP_EDIT', async () => {
            // Get a group to test with
            const groups = await directoryService.listGroups();
            const testGroup = groups.find((g) => g.displayName === 'cloud');
            expect(testGroup).toBeDefined();

            const result = await accessService.check(
                userId,
                Permission.GROUP_EDIT,
                EntityType.GROUP,
                testGroup!.id
            );
            expect(result).toBe(true);
        });

        it('should allow GROUP_DELETE', async () => {
            const groups = await directoryService.listGroups();
            const testGroup = groups.find((g) => g.displayName === 'cloud');
            expect(testGroup).toBeDefined();

            const result = await accessService.check(
                userId,
                Permission.GROUP_DELETE,
                EntityType.GROUP,
                testGroup!.id
            );
            expect(result).toBe(true);
        });
    });

    describe('Group Membership Restrictions', () => {
        let regularGroupId: string;
        let protectedGroupId: string;

        beforeAll(async () => {
            const groups = await directoryService.listGroups();

            const cloudGroup = groups.find((g) => g.displayName === 'cloud');
            expect(cloudGroup).toBeDefined();
            regularGroupId = cloudGroup!.id;

            const adminGroup = groups.find((g) => g.displayName === 'lldap_admin');
            expect(adminGroup).toBeDefined();
            protectedGroupId = adminGroup!.id;
        });

        it('should allow user_manager to add user to regular group', async () => {
            const result = await accessService.check(
                'usermanager',
                Permission.USER_ADD_TO_GROUP,
                EntityType.GROUP,
                regularGroupId
            );
            expect(result).toBe(true);
        });

        it('should deny user_manager to add user to protected group', async () => {
            const result = await accessService.check(
                'usermanager',
                Permission.USER_ADD_TO_GROUP,
                EntityType.GROUP,
                protectedGroupId
            );
            expect(result).toBe(false);
        });

        it('should allow user_manager to remove user from regular group', async () => {
            const result = await accessService.check(
                'usermanager',
                Permission.USER_REMOVE_FROM_GROUP,
                EntityType.GROUP,
                regularGroupId
            );
            expect(result).toBe(true);
        });

        it('should deny user_manager to remove user from protected group', async () => {
            const result = await accessService.check(
                'usermanager',
                Permission.USER_REMOVE_FROM_GROUP,
                EntityType.GROUP,
                protectedGroupId
            );
            expect(result).toBe(false);
        });

        it('should allow admin to modify protected group membership', async () => {
            expect(
                await accessService.check(
                    'admin',
                    Permission.USER_ADD_TO_GROUP,
                    EntityType.GROUP,
                    protectedGroupId
                )
            ).toBe(true);
            expect(
                await accessService.check(
                    'admin',
                    Permission.USER_REMOVE_FROM_GROUP,
                    EntityType.GROUP,
                    protectedGroupId
                )
            ).toBe(true);
        });
    });

    describe('Check With Details', () => {
        it('should return detailed denial reason for user without a role', async () => {
            const result = await accessService.checkWithDetails(
                'test',
                Permission.USER_CREATE,
                EntityType.NONE
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('does not have a valid role');
            expect(result.requiredRole).toBe(Role.PASSWORD_MANAGER);
        });

        it('should return detailed denial reason for insufficient permissions (user has role)', async () => {
            const result = await accessService.checkWithDetails(
                'passwordmanager',
                Permission.USER_CREATE,
                EntityType.NONE
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('not granted');
            expect(result.requiredRole).toBe(Role.USER_MANAGER);
        });

        it('should return detailed denial reason for protected user', async () => {
            const result = await accessService.checkWithDetails(
                'passwordmanager',
                Permission.USER_CHANGE_PASSWORD,
                EntityType.USER,
                'admin'
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('protected group');
            expect(result.requiredRole).toBe(Role.ADMIN);
        });

        it('should return allowed result for permitted operation', async () => {
            const result = await accessService.checkWithDetails(
                'admin',
                Permission.USER_CREATE,
                EntityType.NONE
            );

            expect(result.allowed).toBe(true);
            expect(result.reason).toBeUndefined();
        });
    });

    describe('Authentication Checks', () => {
        it('should deny access for non-existent users', async () => {
            const result = await accessService.checkWithDetails(
                'nonexistent_user_xyz',
                Permission.USER_LIST,
                EntityType.NONE
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('not found');
        });

        it('should deny via check() for non-existent users', async () => {
            const result = await accessService.check(
                'nonexistent_user_xyz',
                Permission.USER_LIST,
                EntityType.NONE
            );

            expect(result).toBe(false);
        });
    });

    describe('Disabled User Checks', () => {
        it('should deny access for disabled users', async () => {
            const result = await accessService.checkWithDetails(
                'disableduser',
                Permission.USER_LIST,
                EntityType.NONE
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('disabled');
        });

        it('should deny via check() for disabled users', async () => {
            const result = await accessService.check(
                'disableduser',
                Permission.USER_VIEW,
                EntityType.USER,
                'test'
            );

            expect(result).toBe(false);
        });
    });
});
