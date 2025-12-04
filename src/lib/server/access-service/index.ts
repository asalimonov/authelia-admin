// Types
export { Role, Permission, EntityType, RolePermissions } from './types';
export type { AccessCheckResult, UserAccessContext } from './types';

// Access Service
export { AccessService, type IAccessService } from './access-service';

// Role Mapper
export type { IRoleMapper, RoleMapperConfig } from './role-mapper';
export { RoleMapperFactory, LLDAPRoleMapper, type DirectoryServiceType } from './role-mapper';

// Factory
export { createAccessService, getAccessService, resetAccessService } from './factory';

// Errors
export { AccessError, AccessDeniedError, ProtectedEntityError } from './errors';
