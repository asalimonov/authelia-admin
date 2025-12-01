import { Role } from '../../types';
import { BaseRoleMapper } from '../base-role-mapper';
import type { RoleMapperConfig } from '../types';

/**
 * Default LLDAP role mapping configuration
 */
export const LLDAP_DEFAULT_CONFIG: RoleMapperConfig = {
    roleGroups: {
        [Role.ADMIN]: ['lldap_admin'],
        [Role.USER_MANAGER]: ['authelia_user_manager'],
        [Role.PASSWORD_MANAGER]: ['lldap_password_manager'],
        [Role.VIEWER]: [], // All authenticated users are viewers
    },
    protectedGroups: ['lldap_admin', 'lldap_password_manager', 'authelia_user_manager'],
};

/**
 * Role mapper for LLDAP directory service
 */
export class LLDAPRoleMapper extends BaseRoleMapper {
    constructor(config?: Partial<RoleMapperConfig>) {
        const mergedRoleGroups = {
            ...LLDAP_DEFAULT_CONFIG.roleGroups,
            ...(config?.roleGroups || {}),
        };

        const mergedProtectedGroups = config?.protectedGroups
            ? [...new Set([...LLDAP_DEFAULT_CONFIG.protectedGroups, ...config.protectedGroups])]
            : [...LLDAP_DEFAULT_CONFIG.protectedGroups];

        super({
            roleGroups: mergedRoleGroups,
            protectedGroups: mergedProtectedGroups,
        });
    }
}
