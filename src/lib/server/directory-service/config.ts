/**
 * Directory service configuration types
 * Configuration is loaded from the centralized config module
 */

export interface LLDAPGraphQLConfig {
	type: 'lldap-graphql';
	endpoint: string;
	user: string;
	password: string;
}

// Future: Add other config types
// export interface ActiveDirectoryConfig { ... }

export type ServiceConfig = LLDAPGraphQLConfig; // | ActiveDirectoryConfig | ...

/**
 * Create a config object directly without loading from file.
 * Useful for testing or programmatic configuration.
 */
export function createLLDAPConfig(
	endpoint: string,
	user: string,
	password: string
): LLDAPGraphQLConfig {
	return {
		type: 'lldap-graphql',
		endpoint,
		user,
		password
	};
}
