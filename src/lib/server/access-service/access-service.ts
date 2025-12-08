import type { IDirectoryService } from '../directory-service';
import { Role, Permission, EntityType, RolePermissions } from './types';
import type { AccessCheckResult, UserAccessContext } from './types';
import type { IRoleMapper } from './role-mapper';
import { createLogger } from '../logger';
import * as m from '$lib/paraglide/messages';

const log = createLogger('access-service');

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
     * Returns null if user doesn't have any defined role
     */
    getUserRole(userId: string): Promise<Role | null>;

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

    /**
     * Check if a user is protected based on provided group names.
     * Use this when you already have the user's groups to avoid additional queries.
     */
    isUserProtectedByGroups(groupNames: string[]): boolean;
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
        log.debug(`Access check: user=${userId}, permission=${permission}, entityType=${entityType}, entityId=${entityId}`);

        // 1. Check if user is authenticated (exists in directory)
        const user = await this.directoryService.getUserDetails(userId);
        if (!user) {
            log.debug(`Access denied: user ${userId} not found`);
            return {
                allowed: false,
                reason: m.access_user_not_found({ userId }),
            };
        }

        // 2. Check if user is in the 'disabled' group
        const groups = user.groups.map((g) => g.displayName);
        if (this.isUserDisabled(groups)) {
            log.debug(`Access denied: user ${userId} is disabled`);
            return {
                allowed: false,
                reason: m.access_user_disabled({ userId }),
            };
        }

        const context = this.buildUserContext(userId, user.groups);

        // 3. Check if user has a valid role (only admin, user_manager, password_manager can access)
        if (context.role === null) {
            log.debug(`Access denied: user ${userId} has no valid role`);
            return {
                allowed: false,
                reason: m.access_no_valid_role({ userId }),
                requiredRole: Role.PASSWORD_MANAGER,
            };
        }

        // 4. Check if user has the base permission
        if (!context.permissions.includes(permission)) {
            log.debug(`Access denied: user ${userId} lacks permission ${permission}`);
            return {
                allowed: false,
                reason: m.access_permission_denied({ permission, role: context.role ?? '' }),
                requiredRole: this.getMinimumRoleForPermission(permission),
            };
        }

        // 5. Admin bypasses all contextual restrictions
        if (context.role === Role.ADMIN) {
            log.debug(`Access granted: user ${userId} is admin`);
            return { allowed: true };
        }

        // 6. Apply contextual restrictions based on permission type
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
                return this.checkPasswordChangeRestriction(context.userId, entityId);

            case Permission.USER_ADD_TO_GROUP:
            case Permission.USER_REMOVE_FROM_GROUP:
                return this.checkGroupMembershipRestriction(permission, entityType, entityId);

            case Permission.USER_DELETE:
            case Permission.USER_EDIT:
                return this.checkUserModificationRestriction(context.userId, entityId);

            default:
                return { allowed: true };
        }
    }

    /**
     * Password change restrictions:
     * - password_manager cannot change password for users in protected groups
     * - user_manager cannot change password for users in protected groups
     */
    private async checkPasswordChangeRestriction(userId: string, targetUserId?: string): Promise<AccessCheckResult> {
        if (!targetUserId) {
            return {
                allowed: false,
                reason: m.access_target_user_required_password(),
            };
        }

        if (userId == targetUserId) {
            return {
                allowed: true
            }
        }

        const isTargetProtected = await this.isUserProtected(targetUserId);
        if (isTargetProtected) {
            return {
                allowed: false,
                reason: m.access_cannot_change_password_protected({ userId: targetUserId }),
                requiredRole: Role.ADMIN,
            };
        }

        return { allowed: true };
    }

    /**
     * Group membership restrictions:
     * - Non-admin users cannot add/remove protected users to/from groups
     * - Non-admin users cannot add/remove users to/from protected groups
     *
     * When entityType is USER, entityId is the target user ID - check if user is protected
     * When entityType is GROUP, entityId is the target group ID - check if group is protected
     */
    private async checkGroupMembershipRestriction(
        permission: Permission,
        entityType: EntityType,
        entityId?: string
    ): Promise<AccessCheckResult> {
        if (!entityId) {
            return {
                allowed: false,
                reason: entityType === EntityType.USER
                    ? m.access_target_user_required_modification()
                    : m.access_group_id_required(),
            };
        }

        // When checking against a USER, verify the target user is not protected
        if (entityType === EntityType.USER) {
            const isTargetProtected = await this.isUserProtected(entityId);
            if (isTargetProtected) {
                return {
                    allowed: false,
                    reason: m.access_cannot_modify_protected_user({ userId: entityId }),
                    requiredRole: Role.ADMIN,
                };
            }
            return { allowed: true };
        }

        // When checking against a GROUP, verify the target group is not protected
        if (entityType === EntityType.GROUP) {
            const group = await this.directoryService.getGroupDetails(entityId);
            if (!group) {
                return {
                    allowed: false,
                    reason: m.group_not_found({ groupId: entityId }),
                };
            }

            if (this.isProtectedGroup(group.displayName)) {
                const reason = permission === Permission.USER_ADD_TO_GROUP
                    ? m.access_cannot_add_to_protected_group({ groupName: group.displayName })
                    : m.access_cannot_remove_from_protected_group({ groupName: group.displayName });
                return {
                    allowed: false,
                    reason,
                    requiredRole: Role.ADMIN,
                };
            }
            return { allowed: true };
        }

        return { allowed: false, reason: 'Invalid entity type for membership operation' };
    }

    /**
     * User modification restrictions:
     * - user_manager cannot delete/edit users in protected groups
     */
    private async checkUserModificationRestriction(userId: string, targetUserId?: string): Promise<AccessCheckResult> {
        if (!targetUserId) {
            return {
                allowed: false,
                reason: m.access_target_user_required_modification(),
            };
        }

        if (userId == targetUserId) {
            return {
                allowed: true
            }
        }

        const isTargetProtected = await this.isUserProtected(targetUserId);
        if (isTargetProtected) {
            return {
                allowed: false,
                reason: m.access_cannot_modify_protected_user({ userId: targetUserId }),
                requiredRole: Role.ADMIN,
            };
        }

        return { allowed: true };
    }

    async getUserRole(userId: string): Promise<Role | null> {
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
            // Return minimal context for non-existent users (no role, no permissions)
            return {
                userId,
                role: null,
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
        // If no role is assigned, user has no permissions
        const permissions = role ? RolePermissions.get(role) || [] : [];

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

    isUserProtectedByGroups(groupNames: string[]): boolean {
        return groupNames.some((g) => this.isProtectedGroup(g));
    }

    /**
     * Find the minimum role required for a permission
     */
    private getMinimumRoleForPermission(permission: Permission): Role {
        const roleOrder: Role[] = [Role.PASSWORD_MANAGER, Role.USER_MANAGER, Role.ADMIN];

        for (const role of roleOrder) {
            const permissions = RolePermissions.get(role) || [];
            if (permissions.includes(permission)) {
                return role;
            }
        }

        return Role.ADMIN;
    }
}
