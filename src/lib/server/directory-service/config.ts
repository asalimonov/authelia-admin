import { promises as fs } from 'node:fs';
import { parse } from 'yaml';

export interface LLDAPGraphQLConfig {
	type: 'lldap_graphql';
	endpoint: string;
	user: string;
	password: string;
}

// Future: Add other config types
// export interface ActiveDirectoryConfig { ... }

export type ServiceConfig = LLDAPGraphQLConfig; // | ActiveDirectoryConfig | ...

export interface DirectoryServiceConfig {
	active: string;
	services: Record<string, ServiceConfig>;
}

export async function loadDirectoryServiceConfig(
	configPath: string = process.env.DIRECTORY_SERVICE_CONFIG_PATH ||
		'/config/directory-service.yml'
): Promise<DirectoryServiceConfig> {
	const content = await fs.readFile(configPath, 'utf-8');
	const parsed = parse(content);

	if (!parsed?.directory_service) {
		throw new Error('Missing directory_service configuration');
	}

	const config = parsed.directory_service as DirectoryServiceConfig;

	// Substitute environment variables in passwords
	for (const [, service] of Object.entries(config.services)) {
		if ('password' in service && typeof service.password === 'string') {
			service.password = substituteEnvVars(service.password);
		}
	}

	return config;
}

function substituteEnvVars(value: string): string {
	return value.replace(/\$\{(\w+)\}/g, (_, envVar) => {
		return process.env[envVar] || '';
	});
}

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
		type: 'lldap_graphql',
		endpoint,
		user,
		password
	};
}
