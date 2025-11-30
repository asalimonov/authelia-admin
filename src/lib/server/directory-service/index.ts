// Public API for directory-service module

// Types
export type {
	IDirectoryService,
	User,
	UserSummary,
	Group,
	GroupSummary,
	AttributeValue,
	AttributeSchema,
	AttributeType,
	Schema,
	CreateUserInput,
	UpdateUserInput,
	CreateGroupInput,
	UpdateGroupInput,
	OperationResult
} from './types';

// Configuration
export { loadDirectoryServiceConfig, type DirectoryServiceConfig } from './config';

// Factory
export { DirectoryServiceFactory } from './factory';

// Implementations (for direct use if needed)
export { LLDAPGraphQLService, LLDAPGraphQLClient } from './implementations/lldap-graphql';
