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
     * Map groups to role using role hierarchy (admin > user_manager > password_manager > viewer)
     */
    mapGroupsToRole(groupNames: string[]): Role {
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

        // Default to viewer for any authenticated user
        return Role.VIEWER;
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
