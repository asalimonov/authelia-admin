import type { Permission, Role } from './types';

/**
 * Base error for access control failures
 */
export class AccessError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AccessError';
    }
}

/**
 * Error thrown when user lacks required permission
 */
export class AccessDeniedError extends AccessError {
    public readonly permission: Permission;
    public readonly userRole: Role;
    public readonly requiredRole?: Role;
    public readonly entityType?: string;
    public readonly entityId?: string;

    constructor(
        permission: Permission,
        userRole: Role,
        options?: {
            requiredRole?: Role;
            entityType?: string;
            entityId?: string;
            reason?: string;
        }
    ) {
        const message =
            options?.reason || `Permission '${permission}' denied for role '${userRole}'`;

        super(message);
        this.name = 'AccessDeniedError';
        this.permission = permission;
        this.userRole = userRole;
        this.requiredRole = options?.requiredRole;
        this.entityType = options?.entityType;
        this.entityId = options?.entityId;
    }
}

/**
 * Error thrown when target entity is protected
 */
export class ProtectedEntityError extends AccessError {
    public readonly entityType: string;
    public readonly entityId: string;

    constructor(entityType: string, entityId: string, reason?: string) {
        super(reason || `Cannot modify protected ${entityType}: ${entityId}`);
        this.name = 'ProtectedEntityError';
        this.entityType = entityType;
        this.entityId = entityId;
    }
}
