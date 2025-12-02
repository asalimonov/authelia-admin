import { Role } from '../types';
import type { IRoleMapper, RoleMapperConfig } from './types';

/**
 * Base implementation of IRoleMapper with common logic
 */
export abstract class BaseRoleMapper implements IRoleMapper {
    protected config: RoleMapperConfig;

    constructor(config: RoleMapperConfig) {
        this.config = config;
    }

    /**
     * Map groups to role using role hierarchy (admin > user_manager > password_manager)
     * Returns null if user doesn't have any of the defined roles
     */
    mapGroupsToRole(groupNames: string[]): Role | null {
        const normalizedGroups = groupNames.map((g) => g.toLowerCase());

        // Check in order of highest to lowest privilege
        const roleOrder: Role[] = [Role.ADMIN, Role.USER_MANAGER, Role.PASSWORD_MANAGER];

        for (const role of roleOrder) {
            const roleGroups = this.config.roleGroups[role] || [];
            const hasRole = roleGroups.some((rg) => normalizedGroups.includes(rg.toLowerCase()));
            if (hasRole) {
                return role;
            }
        }

        // Return null if user doesn't have any defined role
        // Users without a role will be denied access to the application
        return null;
    }

    getProtectedGroups(): string[] {
        return [...this.config.protectedGroups];
    }

    isProtectedGroup(groupName: string): boolean {
        const normalized = groupName.toLowerCase();

        // Check exact matches
        return this.config.protectedGroups.some((pg) => pg.toLowerCase() === normalized);
    }

    getConfig(): RoleMapperConfig {
        return {
            roleGroups: { ...this.config.roleGroups },
            protectedGroups: [...this.config.protectedGroups],
        };
    }
}
