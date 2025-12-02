import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccessService } from './access-service';
import { Role, Permission, EntityType, RolePermissions } from './types';
import { LLDAPRoleMapper } from './role-mapper';
import type { IDirectoryService, User, Group } from '../directory-service';

// Mock user factory
function createMockUser(
    id: string,
    groups: { id: string; displayName: string }[] = []
): User {
    return {
        id,
        email: `${id}@example.com`,
        displayName: `User ${id}`,
        uuid: `uuid-${id}`,
        creationDate: new Date(),
        groups,
        attributes: [],
    };
}

// Mock group factory
function createMockGroup(id: string, displayName: string): Group {
    return {
        id,
        displayName,
        creationDate: new Date(),
        members: [],
        attributes: [],
    };
}

// Create mock directory service
function createMockDirectoryService(
    users: Map<string, User>,
    groups: Map<string, Group>
): IDirectoryService {
    return {
        createUser: vi.fn(),
        updateUser: vi.fn(),
        deleteUser: vi.fn(),
        listUsers: vi.fn(),
        getUserDetails: vi.fn(async (userId: string) => users.get(userId) || null),
        createGroup: vi.fn(),
        updateGroup: vi.fn(),
        deleteGroup: vi.fn(),
        listGroups: vi.fn(),
        getGroupDetails: vi.fn(async (groupId: string) => groups.get(groupId) || null),
        addUserToGroup: vi.fn(),
        removeUserFromGroup: vi.fn(),
        getUserAttributesSchema: vi.fn(),
        getGroupAttributesSchema: vi.fn(),
        testConnection: vi.fn(),
    };
}

describe('AccessService', () => {
    let accessService: AccessService;
    let mockDirectoryService: IDirectoryService;
    let users: Map<string, User>;
    let groups: Map<string, Group>;

    beforeEach(() => {
        users = new Map();
        groups = new Map();

        // Create test users with different roles
        users.set(
            'admin',
            createMockUser('admin', [{ id: 'group-admin', displayName: 'lldap_admin' }])
        );
        users.set(
            'user_manager',
            createMockUser('user_manager', [
                { id: 'group-um', displayName: 'authelia_user_manager' },
            ])
        );
        users.set(
            'password_manager',
            createMockUser('password_manager', [
                { id: 'group-pm', displayName: 'lldap_password_manager' },
            ])
        );
        users.set(
            'viewer',
            createMockUser('viewer', [{ id: 'group-users', displayName: 'users' }])
        );
        users.set(
            'protected_user',
            createMockUser('protected_user', [
                { id: 'group-admin', displayName: 'lldap_admin' },
            ])
        );
        users.set(
            'regular_user',
            createMockUser('regular_user', [{ id: 'group-users', displayName: 'users' }])
        );
        users.set(
            'disabled_user',
            createMockUser('disabled_user', [
                { id: 'group-users', displayName: 'users' },
                { id: 'group-disabled', displayName: 'disabled' },
            ])
        );
        users.set(
            'disabled_admin',
            createMockUser('disabled_admin', [
                { id: 'group-admin', displayName: 'lldap_admin' },
                { id: 'group-disabled', displayName: 'disabled' },
            ])
        );

        // Create test groups
        groups.set('group-admin', createMockGroup('group-admin', 'lldap_admin'));
        groups.set('group-um', createMockGroup('group-um', 'authelia_user_manager'));
        groups.set('group-pm', createMockGroup('group-pm', 'lldap_password_manager'));
        groups.set('group-users', createMockGroup('group-users', 'users'));
        groups.set('group-developers', createMockGroup('group-developers', 'developers'));
        groups.set('group-disabled', createMockGroup('group-disabled', 'disabled'));

        mockDirectoryService = createMockDirectoryService(users, groups);
        const roleMapper = new LLDAPRoleMapper();
        accessService = new AccessService(mockDirectoryService, roleMapper);
    });

    describe('getUserRole', () => {
        it('should return ADMIN for users in lldap_admin group', async () => {
            const role = await accessService.getUserRole('admin');
            expect(role).toBe(Role.ADMIN);
        });

        it('should return USER_MANAGER for users in authelia_user_manager group', async () => {
            const role = await accessService.getUserRole('user_manager');
            expect(role).toBe(Role.USER_MANAGER);
        });

        it('should return PASSWORD_MANAGER for users in lldap_password_manager group', async () => {
            const role = await accessService.getUserRole('password_manager');
            expect(role).toBe(Role.PASSWORD_MANAGER);
        });

        it('should return null for users without special groups', async () => {
            const role = await accessService.getUserRole('viewer');
            expect(role).toBeNull();
        });

        it('should return null for non-existent users', async () => {
            const role = await accessService.getUserRole('nonexistent');
            expect(role).toBeNull();
        });
    });

    describe('getUserPermissions', () => {
        it('should return admin permissions for admin users', async () => {
            const permissions = await accessService.getUserPermissions('admin');
            expect(permissions).toEqual(RolePermissions.get(Role.ADMIN));
        });

        it('should return user_manager permissions for user_manager users', async () => {
            const permissions = await accessService.getUserPermissions('user_manager');
            expect(permissions).toEqual(RolePermissions.get(Role.USER_MANAGER));
        });

        it('should return empty permissions for users without a role', async () => {
            const permissions = await accessService.getUserPermissions('viewer');
            expect(permissions).toEqual([]);
        });
    });

    describe('getUserContext', () => {
        it('should return full context for a user', async () => {
            const context = await accessService.getUserContext('admin');

            expect(context.userId).toBe('admin');
            expect(context.role).toBe(Role.ADMIN);
            expect(context.groups).toContain('lldap_admin');
            expect(context.permissions).toEqual(RolePermissions.get(Role.ADMIN));
        });

        it('should return minimal context for non-existent users', async () => {
            const context = await accessService.getUserContext('nonexistent');

            expect(context.userId).toBe('nonexistent');
            expect(context.role).toBeNull();
            expect(context.groups).toEqual([]);
            expect(context.permissions).toEqual([]);
        });
    });

    describe('isProtectedGroup', () => {
        it('should return true for protected groups', () => {
            expect(accessService.isProtectedGroup('lldap_admin')).toBe(true);
            expect(accessService.isProtectedGroup('lldap_password_manager')).toBe(true);
            expect(accessService.isProtectedGroup('authelia_user_manager')).toBe(true);
        });

        it('should return false for non-protected groups', () => {
            expect(accessService.isProtectedGroup('users')).toBe(false);
            expect(accessService.isProtectedGroup('developers')).toBe(false);
        });
    });

    describe('isUserProtected', () => {
        it('should return true for users in protected groups', async () => {
            const isProtected = await accessService.isUserProtected('admin');
            expect(isProtected).toBe(true);
        });

        it('should return false for users not in protected groups', async () => {
            const isProtected = await accessService.isUserProtected('regular_user');
            expect(isProtected).toBe(false);
        });

        it('should return false for non-existent users', async () => {
            const isProtected = await accessService.isUserProtected('nonexistent');
            expect(isProtected).toBe(false);
        });
    });

    describe('check - basic permissions', () => {
        describe('Users without role', () => {
            it('should deny USER_LIST', async () => {
                const result = await accessService.check(
                    'viewer',
                    Permission.USER_LIST,
                    EntityType.NONE
                );
                expect(result).toBe(false);
            });

            it('should deny USER_VIEW', async () => {
                const result = await accessService.check(
                    'viewer',
                    Permission.USER_VIEW,
                    EntityType.USER,
                    'regular_user'
                );
                expect(result).toBe(false);
            });

            it('should deny GROUP_LIST', async () => {
                const result = await accessService.check(
                    'viewer',
                    Permission.GROUP_LIST,
                    EntityType.NONE
                );
                expect(result).toBe(false);
            });

            it('should deny GROUP_VIEW', async () => {
                const result = await accessService.check(
                    'viewer',
                    Permission.GROUP_VIEW,
                    EntityType.GROUP,
                    'group-users'
                );
                expect(result).toBe(false);
            });

            it('should deny USER_CREATE', async () => {
                const result = await accessService.check(
                    'viewer',
                    Permission.USER_CREATE,
                    EntityType.NONE
                );
                expect(result).toBe(false);
            });

            it('should deny USER_CHANGE_PASSWORD', async () => {
                const result = await accessService.check(
                    'viewer',
                    Permission.USER_CHANGE_PASSWORD,
                    EntityType.USER,
                    'regular_user'
                );
                expect(result).toBe(false);
            });
        });

        describe('PASSWORD_MANAGER role', () => {
            it('should allow USER_CHANGE_PASSWORD for regular users', async () => {
                const result = await accessService.check(
                    'password_manager',
                    Permission.USER_CHANGE_PASSWORD,
                    EntityType.USER,
                    'regular_user'
                );
                expect(result).toBe(true);
            });

            it('should deny USER_CHANGE_PASSWORD for protected users', async () => {
                const result = await accessService.check(
                    'password_manager',
                    Permission.USER_CHANGE_PASSWORD,
                    EntityType.USER,
                    'protected_user'
                );
                expect(result).toBe(false);
            });

            it('should deny USER_CREATE', async () => {
                const result = await accessService.check(
                    'password_manager',
                    Permission.USER_CREATE,
                    EntityType.NONE
                );
                expect(result).toBe(false);
            });
        });

        describe('USER_MANAGER role', () => {
            it('should allow USER_CREATE', async () => {
                const result = await accessService.check(
                    'user_manager',
                    Permission.USER_CREATE,
                    EntityType.NONE
                );
                expect(result).toBe(true);
            });

            it('should allow USER_EDIT for regular users', async () => {
                const result = await accessService.check(
                    'user_manager',
                    Permission.USER_EDIT,
                    EntityType.USER,
                    'regular_user'
                );
                expect(result).toBe(true);
            });

            it('should deny USER_EDIT for protected users', async () => {
                const result = await accessService.check(
                    'user_manager',
                    Permission.USER_EDIT,
                    EntityType.USER,
                    'protected_user'
                );
                expect(result).toBe(false);
            });

            it('should allow USER_DELETE for regular users', async () => {
                const result = await accessService.check(
                    'user_manager',
                    Permission.USER_DELETE,
                    EntityType.USER,
                    'regular_user'
                );
                expect(result).toBe(true);
            });

            it('should deny USER_DELETE for protected users', async () => {
                const result = await accessService.check(
                    'user_manager',
                    Permission.USER_DELETE,
                    EntityType.USER,
                    'protected_user'
                );
                expect(result).toBe(false);
            });

            it('should allow USER_ADD_TO_GROUP for non-protected groups', async () => {
                const result = await accessService.check(
                    'user_manager',
                    Permission.USER_ADD_TO_GROUP,
                    EntityType.GROUP,
                    'group-users'
                );
                expect(result).toBe(true);
            });

            it('should deny USER_ADD_TO_GROUP for protected groups', async () => {
                const result = await accessService.check(
                    'user_manager',
                    Permission.USER_ADD_TO_GROUP,
                    EntityType.GROUP,
                    'group-admin'
                );
                expect(result).toBe(false);
            });

            it('should allow USER_REMOVE_FROM_GROUP for non-protected groups', async () => {
                const result = await accessService.check(
                    'user_manager',
                    Permission.USER_REMOVE_FROM_GROUP,
                    EntityType.GROUP,
                    'group-developers'
                );
                expect(result).toBe(true);
            });

            it('should deny USER_REMOVE_FROM_GROUP for protected groups', async () => {
                const result = await accessService.check(
                    'user_manager',
                    Permission.USER_REMOVE_FROM_GROUP,
                    EntityType.GROUP,
                    'group-pm'
                );
                expect(result).toBe(false);
            });

            it('should deny GROUP_CREATE', async () => {
                const result = await accessService.check(
                    'user_manager',
                    Permission.GROUP_CREATE,
                    EntityType.NONE
                );
                expect(result).toBe(false);
            });
        });

        describe('ADMIN role', () => {
            it('should allow all operations', async () => {
                // User operations
                expect(
                    await accessService.check('admin', Permission.USER_LIST, EntityType.NONE)
                ).toBe(true);
                expect(
                    await accessService.check('admin', Permission.USER_CREATE, EntityType.NONE)
                ).toBe(true);
                expect(
                    await accessService.check(
                        'admin',
                        Permission.USER_EDIT,
                        EntityType.USER,
                        'protected_user'
                    )
                ).toBe(true);
                expect(
                    await accessService.check(
                        'admin',
                        Permission.USER_DELETE,
                        EntityType.USER,
                        'protected_user'
                    )
                ).toBe(true);
                expect(
                    await accessService.check(
                        'admin',
                        Permission.USER_CHANGE_PASSWORD,
                        EntityType.USER,
                        'protected_user'
                    )
                ).toBe(true);

                // Group operations
                expect(
                    await accessService.check('admin', Permission.GROUP_LIST, EntityType.NONE)
                ).toBe(true);
                expect(
                    await accessService.check('admin', Permission.GROUP_CREATE, EntityType.NONE)
                ).toBe(true);
                expect(
                    await accessService.check(
                        'admin',
                        Permission.GROUP_EDIT,
                        EntityType.GROUP,
                        'group-admin'
                    )
                ).toBe(true);
                expect(
                    await accessService.check(
                        'admin',
                        Permission.GROUP_DELETE,
                        EntityType.GROUP,
                        'group-admin'
                    )
                ).toBe(true);

                // Group membership operations on protected groups
                expect(
                    await accessService.check(
                        'admin',
                        Permission.USER_ADD_TO_GROUP,
                        EntityType.GROUP,
                        'group-admin'
                    )
                ).toBe(true);
                expect(
                    await accessService.check(
                        'admin',
                        Permission.USER_REMOVE_FROM_GROUP,
                        EntityType.GROUP,
                        'group-admin'
                    )
                ).toBe(true);
            });
        });
    });

    describe('checkWithDetails', () => {
        it('should return detailed result for user without a role', async () => {
            const result = await accessService.checkWithDetails(
                'viewer',
                Permission.USER_CREATE,
                EntityType.NONE
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('does not have a valid role');
            expect(result.requiredRole).toBe(Role.PASSWORD_MANAGER);
        });

        it('should return detailed result for denied permission when user has role', async () => {
            const result = await accessService.checkWithDetails(
                'password_manager',
                Permission.USER_CREATE,
                EntityType.NONE
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Permission');
            expect(result.reason).toContain('not granted');
            expect(result.requiredRole).toBe(Role.USER_MANAGER);
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

        it('should return reason when password change denied for protected user', async () => {
            const result = await accessService.checkWithDetails(
                'password_manager',
                Permission.USER_CHANGE_PASSWORD,
                EntityType.USER,
                'protected_user'
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('protected group');
            expect(result.requiredRole).toBe(Role.ADMIN);
        });

        it('should return reason when group membership change denied for protected group', async () => {
            const result = await accessService.checkWithDetails(
                'user_manager',
                Permission.USER_ADD_TO_GROUP,
                EntityType.GROUP,
                'group-admin'
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('protected group');
            expect(result.requiredRole).toBe(Role.ADMIN);
        });
    });

    describe('edge cases', () => {
        it('should deny password change without target user ID', async () => {
            const result = await accessService.checkWithDetails(
                'password_manager',
                Permission.USER_CHANGE_PASSWORD,
                EntityType.USER
                // No entityId provided
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Target user ID required');
        });

        it('should deny group membership change without group ID', async () => {
            const result = await accessService.checkWithDetails(
                'user_manager',
                Permission.USER_ADD_TO_GROUP,
                EntityType.NONE // Wrong entity type
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Group ID required');
        });

        it('should deny group membership change for non-existent group', async () => {
            const result = await accessService.checkWithDetails(
                'user_manager',
                Permission.USER_ADD_TO_GROUP,
                EntityType.GROUP,
                'non-existent-group'
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('not found');
        });

        it('should deny user modification without target user ID', async () => {
            const result = await accessService.checkWithDetails(
                'user_manager',
                Permission.USER_EDIT,
                EntityType.USER
                // No entityId provided
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Target user ID required');
        });
    });

    describe('authentication checks', () => {
        it('should deny access for non-existent users', async () => {
            const result = await accessService.checkWithDetails(
                'nonexistent_user',
                Permission.USER_LIST,
                EntityType.NONE
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('not found');
            expect(result.reason).toContain('not authenticated');
        });

        it('should deny via check() for non-existent users', async () => {
            const result = await accessService.check(
                'nonexistent_user',
                Permission.USER_LIST,
                EntityType.NONE
            );

            expect(result).toBe(false);
        });
    });

    describe('disabled user checks', () => {
        it('should deny access for disabled users', async () => {
            const result = await accessService.checkWithDetails(
                'disabled_user',
                Permission.USER_LIST,
                EntityType.NONE
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('disabled');
        });

        it('should deny access for disabled admin', async () => {
            // Even admins should be denied if they are in the disabled group
            const result = await accessService.checkWithDetails(
                'disabled_admin',
                Permission.USER_CREATE,
                EntityType.NONE
            );

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('disabled');
        });

        it('should deny via check() for disabled users', async () => {
            const result = await accessService.check(
                'disabled_user',
                Permission.USER_VIEW,
                EntityType.USER,
                'regular_user'
            );

            expect(result).toBe(false);
        });

        it('should allow access for non-disabled users with role', async () => {
            const result = await accessService.checkWithDetails(
                'password_manager',
                Permission.USER_LIST,
                EntityType.NONE
            );

            expect(result.allowed).toBe(true);
        });
    });
});
