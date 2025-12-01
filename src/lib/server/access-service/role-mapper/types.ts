import type { Role } from '../types';

/**
 * Configuration for role mapping
 */
export interface RoleMapperConfig {
    /** Map of Role -> group names that grant this role */
    roleGroups: Record<Role, string[]>;

    /** Group names that are protected (admin-only operations) */
    protectedGroups: string[];
}

/**
 * Interface for directory-specific role mapping
 * Each DirectoryService implementation should have a corresponding RoleMapper
 */
export interface IRoleMapper {
    /**
     * Determine the highest role from a list of group names
     * @param groupNames - Array of group display names the user belongs to
     * @returns The highest role the user has
     */
    mapGroupsToRole(groupNames: string[]): Role;

    /**
     * Get all groups that are protected from non-admin operations
     * @returns Array of protected group names
     */
    getProtectedGroups(): string[];

    /**
     * Check if a group name matches any protected group
     * @param groupName - The group name to check
     * @returns true if the group is protected
     */
    isProtectedGroup(groupName: string): boolean;

    /**
     * Get the configuration used by this mapper
     */
    getConfig(): RoleMapperConfig;
}
