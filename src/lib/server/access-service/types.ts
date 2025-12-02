/**
 * Application roles - abstract from directory-specific groups
 * Only users with one of these roles can access the application.
 * Users without any role will be denied access.
 */
export enum Role {
    ADMIN = 'admin',
    USER_MANAGER = 'user_manager',
    PASSWORD_MANAGER = 'password_manager',
}

/**
 * Granular permissions for all operations
 */
export enum Permission {
    // User permissions
    USER_VIEW = 'user.view',
    USER_LIST = 'user.list',
    USER_CREATE = 'user.create',
    USER_EDIT = 'user.edit',
    USER_DELETE = 'user.delete',
    USER_CHANGE_PASSWORD = 'user.change_password',
    USER_ADD_TO_GROUP = 'user.add_to_group',
    USER_REMOVE_FROM_GROUP = 'user.remove_from_group',

    // Group permissions
    GROUP_VIEW = 'group.view',
    GROUP_LIST = 'group.list',
    GROUP_CREATE = 'group.create',
    GROUP_EDIT = 'group.edit',
    GROUP_DELETE = 'group.delete',
}

/**
 * Entity types for contextual permission checks
 */
export enum EntityType {
    NONE = 'none',
    USER = 'user',
    GROUP = 'group',
}

/**
 * Role-to-permissions mapping using inheritance pattern
 * PASSWORD_MANAGER is the base role with read-only access + password changes
 */
export const RolePermissions = new Map<Role, Permission[]>();

// Password Manager: read-only access + password changes (base role)
RolePermissions.set(Role.PASSWORD_MANAGER, [
    Permission.USER_VIEW,
    Permission.USER_LIST,
    Permission.GROUP_VIEW,
    Permission.GROUP_LIST,
    Permission.USER_CHANGE_PASSWORD,
]);

// User Manager: password_manager + user/group membership management
RolePermissions.set(Role.USER_MANAGER, [
    ...(RolePermissions.get(Role.PASSWORD_MANAGER) || []),
    Permission.USER_CREATE,
    Permission.USER_EDIT,
    Permission.USER_DELETE,
    Permission.USER_ADD_TO_GROUP,
    Permission.USER_REMOVE_FROM_GROUP,
]);

// Admin: all permissions
RolePermissions.set(Role.ADMIN, [
    ...(RolePermissions.get(Role.USER_MANAGER) || []),
    Permission.GROUP_CREATE,
    Permission.GROUP_EDIT,
    Permission.GROUP_DELETE,
]);

/**
 * Access check result with detailed information
 */
export interface AccessCheckResult {
    allowed: boolean;
    reason?: string;
    requiredRole?: Role;
}

/**
 * User context for access decisions
 */
export interface UserAccessContext {
    userId: string;
    role: Role | null;
    permissions: Permission[];
    groups: string[];
}
