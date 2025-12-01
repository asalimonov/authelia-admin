import type { IDirectoryService } from '../directory-service';
import { Role, Permission, EntityType, RolePermissions } from './types';
import type { AccessCheckResult, UserAccessContext } from './types';
import type { IRoleMapper } from './role-mapper';

export interface IAccessService {
    /**
     * Check if user has permission to perform action on entity
     * @param userId - The ID of the user performing the action
     * @param permission - The permission being checked
     * @param entityType - Type of entity (NONE, USER, GROUP)
     * @param entityId - ID of the entity (optional, required for contextual checks)
     * @returns true if allowed, false if denied
     */
    check(
        userId: string,
        permission: Permission,
        entityType: EntityType,
        entityId?: string
    ): Promise<boolean>;

    /**
     * Check with detailed result information
     */
    checkWithDetails(
        userId: string,
        permission: Permission,
        entityType: EntityType,
        entityId?: string
    ): Promise<AccessCheckResult>;

    /**
     * Get the role for a user based on their group memberships
     */
    getUserRole(userId: string): Promise<Role>;

    /**
     * Get all permissions for a user based on their role
     */
    getUserPermissions(userId: string): Promise<Permission[]>;

    /**
     * Get full access context for a user (role, permissions, groups)
     */
    getUserContext(userId: string): Promise<UserAccessContext>;

    /**
     * Check if a group is protected (requires admin access)
     */
    isProtectedGroup(groupName: string): boolean;

    /**
     * Check if a user is in any protected group
     */
    isUserProtected(userId: string): Promise<boolean>;
}

/**
 * Main AccessService implementation
 */
export class AccessService implements IAccessService {
    private directoryService: IDirectoryService;
    private roleMapper: IRoleMapper;

    constructor(directoryService: IDirectoryService, roleMapper: IRoleMapper) {
        this.directoryService = directoryService;
        this.roleMapper = roleMapper;
    }

    async check(
        userId: string,
        permission: Permission,
        entityType: EntityType,
        entityId?: string
    ): Promise<boolean> {
        const result = await this.checkWithDetails(userId, permission, entityType, entityId);
        return result.allowed;
    }

    async checkWithDetails(
        userId: string,
        permission: Permission,
        entityType: EntityType,
        entityId?: string
    ): Promise<AccessCheckResult> {
        // 1. Check if user is authenticated (exists in directory)
        const user = await this.directoryService.getUserDetails(userId);
        if (!user) {
            return {
                allowed: false,
                reason: `User '${userId}' not found or not authenticated`,
            };
        }

        // 2. Check if user is in the 'disabled' group
        const groups = user.groups.map((g) => g.displayName);
        if (this.isUserDisabled(groups)) {
            return {
                allowed: false,
                reason: `User '${userId}' is disabled`,
            };
        }

        const context = this.buildUserContext(userId, user.groups);

        // 3. Check if user has the base permission
        if (!context.permissions.includes(permission)) {
            return {
                allowed: false,
                reason: `Permission '${permission}' not granted to role '${context.role}'`,
                requiredRole: this.getMinimumRoleForPermission(permission),
            };
        }

        // 4. Admin bypasses all contextual restrictions
        if (context.role === Role.ADMIN) {
            return { allowed: true };
        }

        // 5. Apply contextual restrictions based on permission type
        return this.checkContextualRestrictions(context, permission, entityType, entityId);
    }

    /**
     * Check if user is in the 'disabled' group
     */
    private isUserDisabled(groups: string[]): boolean {
        return groups.some((g) => g.toLowerCase() === 'disabled');
    }

    private async checkContextualRestrictions(
        context: UserAccessContext,
        permission: Permission,
        entityType: EntityType,
        entityId?: string
    ): Promise<AccessCheckResult> {
        switch (permission) {
            case Permission.USER_CHANGE_PASSWORD:
                return this.checkPasswordChangeRestriction(entityId);

            case Permission.USER_ADD_TO_GROUP:
            case Permission.USER_REMOVE_FROM_GROUP:
                return this.checkGroupMembershipRestriction(permission, entityType, entityId);

            case Permission.USER_DELETE:
            case Permission.USER_EDIT:
                return this.checkUserModificationRestriction(entityId);

            default:
                return { allowed: true };
        }
    }

    /**
     * Password change restrictions:
     * - password_manager cannot change password for users in protected groups
     * - user_manager cannot change password for users in protected groups
     */
    private async checkPasswordChangeRestriction(targetUserId?: string): Promise<AccessCheckResult> {
        if (!targetUserId) {
            return {
                allowed: false,
                reason: 'Target user ID required for password change',
            };
        }

        const isTargetProtected = await this.isUserProtected(targetUserId);
        if (isTargetProtected) {
            return {
                allowed: false,
                reason: `Cannot change password for user '${targetUserId}' - user is in a protected group`,
                requiredRole: Role.ADMIN,
            };
        }

        return { allowed: true };
    }

    /**
     * Group membership restrictions:
     * - user_manager cannot add/remove users to/from protected groups
     */
    private async checkGroupMembershipRestriction(
        permission: Permission,
        entityType: EntityType,
        entityId?: string
    ): Promise<AccessCheckResult> {
        if (entityType !== EntityType.GROUP || !entityId) {
            return {
                allowed: false,
                reason: 'Group ID required for membership operations',
            };
        }

        // Get group details to check if it's protected
        const group = await this.directoryService.getGroupDetails(entityId);
        if (!group) {
            return {
                allowed: false,
                reason: `Group '${entityId}' not found`,
            };
        }

        if (this.isProtectedGroup(group.displayName)) {
            const action =
                permission === Permission.USER_ADD_TO_GROUP ? 'add users to' : 'remove users from';
            return {
                allowed: false,
                reason: `Cannot ${action} protected group '${group.displayName}'`,
                requiredRole: Role.ADMIN,
            };
        }

        return { allowed: true };
    }

    /**
     * User modification restrictions:
     * - user_manager cannot delete/edit users in protected groups
     */
    private async checkUserModificationRestriction(targetUserId?: string): Promise<AccessCheckResult> {
        if (!targetUserId) {
            return {
                allowed: false,
                reason: 'Target user ID required for user modification',
            };
        }

        const isTargetProtected = await this.isUserProtected(targetUserId);
        if (isTargetProtected) {
            return {
                allowed: false,
                reason: `Cannot modify user '${targetUserId}' - user is in a protected group`,
                requiredRole: Role.ADMIN,
            };
        }

        return { allowed: true };
    }

    async getUserRole(userId: string): Promise<Role> {
        const context = await this.getUserContext(userId);
        return context.role;
    }

    async getUserPermissions(userId: string): Promise<Permission[]> {
        const context = await this.getUserContext(userId);
        return context.permissions;
    }

    async getUserContext(userId: string): Promise<UserAccessContext> {
        // Fetch user details from directory service
        const user = await this.directoryService.getUserDetails(userId);

        if (!user) {
            // Return minimal context for non-existent users
            return {
                userId,
                role: Role.VIEWER,
                permissions: [],
                groups: [],
            };
        }

        return this.buildUserContext(userId, user.groups);
    }

    /**
     * Build user context from groups (used internally to avoid duplicate lookups)
     */
    private buildUserContext(
        userId: string,
        userGroups: { id: string; displayName: string }[]
    ): UserAccessContext {
        const groups = userGroups.map((g) => g.displayName);
        const role = this.roleMapper.mapGroupsToRole(groups);
        const permissions = RolePermissions.get(role) || [];

        return {
            userId,
            role,
            permissions: [...permissions],
            groups,
        };
    }

    isProtectedGroup(groupName: string): boolean {
        return this.roleMapper.isProtectedGroup(groupName);
    }

    async isUserProtected(userId: string): Promise<boolean> {
        const user = await this.directoryService.getUserDetails(userId);
        if (!user) {
            return false;
        }

        return user.groups.some((g) => this.isProtectedGroup(g.displayName));
    }

    /**
     * Find the minimum role required for a permission
     */
    private getMinimumRoleForPermission(permission: Permission): Role {
        const roleOrder: Role[] = [Role.VIEWER, Role.PASSWORD_MANAGER, Role.USER_MANAGER, Role.ADMIN];

        for (const role of roleOrder) {
            const permissions = RolePermissions.get(role) || [];
            if (permissions.includes(permission)) {
                return role;
            }
        }

        return Role.ADMIN;
    }
}
