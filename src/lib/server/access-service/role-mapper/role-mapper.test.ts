import { describe, it, expect } from 'vitest';
import { Role } from '../types';
import { LLDAPRoleMapper, LLDAP_DEFAULT_CONFIG } from './implementations/lldap-role-mapper';
import { RoleMapperFactory } from './factory';

describe('LLDAPRoleMapper', () => {
    describe('mapGroupsToRole', () => {
        it('should return ADMIN role for users in lldap_admin group', () => {
            const mapper = new LLDAPRoleMapper();
            const result = mapper.mapGroupsToRole(['lldap_admin']);
            expect(result).toBe(Role.ADMIN);
        });

        it('should return ADMIN role for users in lldap_admin group (case insensitive)', () => {
            const mapper = new LLDAPRoleMapper();
            const result = mapper.mapGroupsToRole(['LLDAP_ADMIN']);
            expect(result).toBe(Role.ADMIN);
        });

        it('should return USER_MANAGER role for users in authelia_user_manager group', () => {
            const mapper = new LLDAPRoleMapper();
            const result = mapper.mapGroupsToRole(['authelia_user_manager']);
            expect(result).toBe(Role.USER_MANAGER);
        });

        it('should return PASSWORD_MANAGER role for users in lldap_password_manager group', () => {
            const mapper = new LLDAPRoleMapper();
            const result = mapper.mapGroupsToRole(['lldap_password_manager']);
            expect(result).toBe(Role.PASSWORD_MANAGER);
        });

        it('should return VIEWER role for users with no special groups', () => {
            const mapper = new LLDAPRoleMapper();
            const result = mapper.mapGroupsToRole(['users', 'developers']);
            expect(result).toBe(Role.VIEWER);
        });

        it('should return VIEWER role for users with empty groups', () => {
            const mapper = new LLDAPRoleMapper();
            const result = mapper.mapGroupsToRole([]);
            expect(result).toBe(Role.VIEWER);
        });

        it('should return highest role when user has multiple role groups', () => {
            const mapper = new LLDAPRoleMapper();

            // Admin is highest
            expect(mapper.mapGroupsToRole(['lldap_admin', 'authelia_user_manager'])).toBe(
                Role.ADMIN
            );
            expect(mapper.mapGroupsToRole(['lldap_admin', 'lldap_password_manager'])).toBe(
                Role.ADMIN
            );

            // User manager > password manager
            expect(
                mapper.mapGroupsToRole(['authelia_user_manager', 'lldap_password_manager'])
            ).toBe(Role.USER_MANAGER);
        });

        it('should handle mixed case groups correctly', () => {
            const mapper = new LLDAPRoleMapper();
            const result = mapper.mapGroupsToRole(['Users', 'LLDAP_Password_Manager', 'Developers']);
            expect(result).toBe(Role.PASSWORD_MANAGER);
        });
    });

    describe('isProtectedGroup', () => {
        it('should return true for lldap_admin', () => {
            const mapper = new LLDAPRoleMapper();
            expect(mapper.isProtectedGroup('lldap_admin')).toBe(true);
        });

        it('should return true for lldap_password_manager', () => {
            const mapper = new LLDAPRoleMapper();
            expect(mapper.isProtectedGroup('lldap_password_manager')).toBe(true);
        });

        it('should return true for authelia_user_manager', () => {
            const mapper = new LLDAPRoleMapper();
            expect(mapper.isProtectedGroup('authelia_user_manager')).toBe(true);
        });

        it('should return true for protected groups (case insensitive)', () => {
            const mapper = new LLDAPRoleMapper();
            expect(mapper.isProtectedGroup('LLDAP_ADMIN')).toBe(true);
            expect(mapper.isProtectedGroup('Lldap_Admin')).toBe(true);
        });

        it('should return false for non-protected groups', () => {
            const mapper = new LLDAPRoleMapper();
            expect(mapper.isProtectedGroup('users')).toBe(false);
            expect(mapper.isProtectedGroup('developers')).toBe(false);
            expect(mapper.isProtectedGroup('cloud')).toBe(false);
        });
    });

    describe('getProtectedGroups', () => {
        it('should return default protected groups', () => {
            const mapper = new LLDAPRoleMapper();
            const protectedGroups = mapper.getProtectedGroups();

            expect(protectedGroups).toContain('lldap_admin');
            expect(protectedGroups).toContain('lldap_password_manager');
            expect(protectedGroups).toContain('authelia_user_manager');
        });
    });

    describe('getConfig', () => {
        it('should return a copy of the configuration', () => {
            const mapper = new LLDAPRoleMapper();
            const config = mapper.getConfig();

            expect(config.roleGroups[Role.ADMIN]).toEqual(['lldap_admin']);
            expect(config.roleGroups[Role.USER_MANAGER]).toEqual(['authelia_user_manager']);
            expect(config.roleGroups[Role.PASSWORD_MANAGER]).toEqual(['lldap_password_manager']);
            expect(config.roleGroups[Role.VIEWER]).toEqual([]);
        });
    });

    describe('custom configuration', () => {
        it('should allow overriding role groups', () => {
            const mapper = new LLDAPRoleMapper({
                roleGroups: {
                    [Role.ADMIN]: ['super_admins', 'lldap_admin'],
                    [Role.USER_MANAGER]: ['authelia_user_manager'],
                    [Role.PASSWORD_MANAGER]: ['lldap_password_manager'],
                    [Role.VIEWER]: [],
                },
            });

            expect(mapper.mapGroupsToRole(['super_admins'])).toBe(Role.ADMIN);
            expect(mapper.mapGroupsToRole(['lldap_admin'])).toBe(Role.ADMIN);
        });

        it('should allow adding additional protected groups', () => {
            const mapper = new LLDAPRoleMapper({
                protectedGroups: ['security_team'],
            });

            expect(mapper.isProtectedGroup('security_team')).toBe(true);
            // Default protected groups should still work
            expect(mapper.isProtectedGroup('lldap_admin')).toBe(true);
        });
    });
});

describe('RoleMapperFactory', () => {
    describe('create', () => {
        it('should create LLDAP role mapper for lldap-graphql type', () => {
            const mapper = RoleMapperFactory.create('lldap-graphql');
            expect(mapper).toBeInstanceOf(LLDAPRoleMapper);
        });

        it('should create LLDAP role mapper with custom config', () => {
            const mapper = RoleMapperFactory.create('lldap-graphql', {
                protectedGroups: ['custom_protected'],
            });

            expect(mapper.isProtectedGroup('custom_protected')).toBe(true);
            expect(mapper.isProtectedGroup('lldap_admin')).toBe(true);
        });

        it('should throw error for unsupported directory type', () => {
            expect(() => {
                // @ts-expect-error Testing invalid type
                RoleMapperFactory.create('unsupported-type');
            }).toThrow('Unsupported directory service type: unsupported-type');
        });
    });

    describe('createFromConfig', () => {
        it('should create role mapper from directory config', () => {
            const mapper = RoleMapperFactory.createFromConfig({ type: 'lldap-graphql' });
            expect(mapper).toBeInstanceOf(LLDAPRoleMapper);
        });

        it('should create role mapper with custom role mapper config', () => {
            const mapper = RoleMapperFactory.createFromConfig(
                { type: 'lldap-graphql' },
                { protectedGroups: ['extra_protected'] }
            );

            expect(mapper.isProtectedGroup('extra_protected')).toBe(true);
        });
    });
});

describe('LLDAP_DEFAULT_CONFIG', () => {
    it('should have correct default role groups', () => {
        expect(LLDAP_DEFAULT_CONFIG.roleGroups[Role.ADMIN]).toEqual(['lldap_admin']);
        expect(LLDAP_DEFAULT_CONFIG.roleGroups[Role.USER_MANAGER]).toEqual([
            'authelia_user_manager',
        ]);
        expect(LLDAP_DEFAULT_CONFIG.roleGroups[Role.PASSWORD_MANAGER]).toEqual([
            'lldap_password_manager',
        ]);
        expect(LLDAP_DEFAULT_CONFIG.roleGroups[Role.VIEWER]).toEqual([]);
    });

    it('should have correct default protected groups', () => {
        expect(LLDAP_DEFAULT_CONFIG.protectedGroups).toContain('lldap_admin');
        expect(LLDAP_DEFAULT_CONFIG.protectedGroups).toContain('lldap_password_manager');
        expect(LLDAP_DEFAULT_CONFIG.protectedGroups).toContain('authelia_user_manager');
    });
});
