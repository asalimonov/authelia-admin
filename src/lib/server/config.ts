/**
 * Centralized application configuration loader
 * Loads configuration from /opt/authelia-admin/config.yml (or configured path)
 *
 * Environment variables use the AAD_ prefix (Authelia Admin):
 * - AAD_AUTHELIA_DOMAIN, AAD_AUTHELIA_COOKIE_NAME, etc.
 * - AAD_DIRECTORY_TYPE, AAD_DIRECTORY_LLDAP_GRAPHQL_ENDPOINT, etc.
 */

import { promises as fs } from 'node:fs';
import { parse } from 'yaml';

// === Configuration Interfaces ===

export interface AutheliaConfig {
	domain: string;
	cookie_name: string;
	min_auth_level: number;
	allowed_users: string[];
}

export interface LLDAPGraphQLConfigFields {
	endpoint: string;
	user: string;
	password: string;
	ldap_host: string;
	ldap_port: number;
	ldap_base_dn?: string;
}

export interface DirectoryConfig {
	type: 'lldap-graphql';
	'lldap-graphql': LLDAPGraphQLConfigFields;
}

export interface AppConfig {
	authelia: AutheliaConfig;
	directory: DirectoryConfig;
}

// === Default Values ===

const DEFAULT_CONFIG_PATH = '/opt/authelia-admin/config.yml';

const DEFAULT_AUTHELIA_CONFIG: AutheliaConfig = {
	domain: 'auth.localhost.test',
	cookie_name: 'authelia_session',
	min_auth_level: 2,
	allowed_users: []
};

const DEFAULT_LLDAP_GRAPHQL_CONFIG: LLDAPGraphQLConfigFields = {
	endpoint: 'http://lldap:17170/api/graphql',
	user: 'admin',
	password: '',
	ldap_host: 'lldap',
	ldap_port: 3890
};

// === Singleton State ===

let configInstance: AppConfig | null = null;
let configLoadPromise: Promise<AppConfig> | null = null;

// === Config Loading Functions ===

/**
 * Load and parse configuration from YAML file
 */
export async function loadConfig(
	configPath: string = process.env.AAD_CONFIG_PATH || process.env.CONFIG_PATH || DEFAULT_CONFIG_PATH
): Promise<AppConfig> {
	if (configInstance) {
		return configInstance;
	}

	if (configLoadPromise) {
		return configLoadPromise;
	}

	configLoadPromise = (async () => {
		try {
			const content = await fs.readFile(configPath, 'utf-8');
			const parsed = parse(content);

			configInstance = {
				authelia: parseAutheliaConfig(parsed?.authelia),
				directory: parseDirectoryConfig(parsed?.directory)
			};

			console.log(`Configuration loaded from ${configPath}`);
			return configInstance;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
				console.warn(
					`Configuration file not found at ${configPath}, using defaults and environment variables`
				);
				configInstance = loadFromEnvironment();
				return configInstance;
			}
			throw new Error(`Failed to load configuration: ${(error as Error).message}`);
		} finally {
			configLoadPromise = null;
		}
	})();

	return configLoadPromise;
}

/**
 * Get loaded configuration (throws if not loaded)
 */
export function getConfig(): AppConfig {
	if (!configInstance) {
		throw new Error('Configuration not loaded. Call loadConfig() first.');
	}
	return configInstance;
}

/**
 * Get configuration async (loads if needed)
 */
export async function getConfigAsync(): Promise<AppConfig> {
	return configInstance || loadConfig();
}

/**
 * Reset configuration singleton (for testing)
 */
export function resetConfig(): void {
	configInstance = null;
	configLoadPromise = null;
}

// === Parsing Helpers ===

function parseAutheliaConfig(config: unknown): AutheliaConfig {
	const cfg = (config && typeof config === 'object') ? config as Record<string, unknown> : {};

	// Parse from YAML with env var substitution, then apply env var overrides
	const domain = process.env.AAD_AUTHELIA_DOMAIN ||
		substituteEnvVars(String(cfg.domain || DEFAULT_AUTHELIA_CONFIG.domain));

	const cookie_name = process.env.AAD_AUTHELIA_COOKIE_NAME ||
		substituteEnvVars(String(cfg.cookie_name || DEFAULT_AUTHELIA_CONFIG.cookie_name));

	const min_auth_level = process.env.AAD_AUTHELIA_MIN_AUTH_LEVEL
		? parseInt(process.env.AAD_AUTHELIA_MIN_AUTH_LEVEL, 10)
		: (cfg.min_auth_level !== undefined
			? Number(cfg.min_auth_level)
			: DEFAULT_AUTHELIA_CONFIG.min_auth_level);

	const allowed_users = process.env.AAD_AUTHELIA_ALLOWED_USERS
		? process.env.AAD_AUTHELIA_ALLOWED_USERS.split(',').map((u) => u.trim()).filter((u) => u.length > 0)
		: parseAllowedUsers(cfg.allowed_users);

	return { domain, cookie_name, min_auth_level, allowed_users };
}

function parseDirectoryConfig(config: unknown): DirectoryConfig {
	const cfg = (config && typeof config === 'object') ? config as Record<string, unknown> : {};

	// Get type from env var or config
	const type = process.env.AAD_DIRECTORY_TYPE ||
		substituteEnvVars(String(cfg.type || 'lldap-graphql'));

	if (type !== 'lldap-graphql') {
		throw new Error(`Unsupported directory type: ${type}`);
	}

	// Parse the type-specific config
	const lldapConfig = parseLLDAPGraphQLConfig(cfg['lldap-graphql']);

	return {
		type: 'lldap-graphql',
		'lldap-graphql': lldapConfig
	};
}

function parseLLDAPGraphQLConfig(config: unknown): LLDAPGraphQLConfigFields {
	const cfg = (config && typeof config === 'object') ? config as Record<string, unknown> : {};

	// Each field can be overridden by AAD_DIRECTORY_LLDAP_GRAPHQL_* env vars
	const endpoint = process.env.AAD_DIRECTORY_LLDAP_GRAPHQL_ENDPOINT ||
		substituteEnvVars(String(cfg.endpoint || DEFAULT_LLDAP_GRAPHQL_CONFIG.endpoint));

	const user = process.env.AAD_DIRECTORY_LLDAP_GRAPHQL_USER ||
		substituteEnvVars(String(cfg.user || DEFAULT_LLDAP_GRAPHQL_CONFIG.user));

	const password = process.env.AAD_DIRECTORY_LLDAP_GRAPHQL_PASSWORD ||
		substituteEnvVars(String(cfg.password || DEFAULT_LLDAP_GRAPHQL_CONFIG.password));

	const ldap_host = process.env.AAD_DIRECTORY_LLDAP_GRAPHQL_LDAP_HOST ||
		substituteEnvVars(String(cfg.ldap_host || DEFAULT_LLDAP_GRAPHQL_CONFIG.ldap_host));

	const ldap_port = process.env.AAD_DIRECTORY_LLDAP_GRAPHQL_LDAP_PORT
		? parseInt(process.env.AAD_DIRECTORY_LLDAP_GRAPHQL_LDAP_PORT, 10)
		: (cfg.ldap_port !== undefined
			? Number(cfg.ldap_port)
			: DEFAULT_LLDAP_GRAPHQL_CONFIG.ldap_port);

	// ldap_base_dn is optional with no default - must be explicitly configured
	const ldap_base_dn = process.env.AAD_DIRECTORY_LLDAP_GRAPHQL_LDAP_BASE_DN ||
		(cfg.ldap_base_dn ? substituteEnvVars(String(cfg.ldap_base_dn)) : undefined);

	return { endpoint, user, password, ldap_host, ldap_port, ldap_base_dn };
}

function parseAllowedUsers(users: unknown): string[] {
	if (Array.isArray(users)) {
		return users.map((u) => String(u).trim()).filter((u) => u.length > 0);
	}
	if (typeof users === 'string') {
		return users
			.split(',')
			.map((u) => u.trim())
			.filter((u) => u.length > 0);
	}
	return DEFAULT_AUTHELIA_CONFIG.allowed_users;
}

// === Environment Variable Fallbacks ===

function loadFromEnvironment(): AppConfig {
	return {
		authelia: parseAutheliaConfig({}),
		directory: parseDirectoryConfig({})
	};
}

function substituteEnvVars(value: string): string {
	return value.replace(/\$\{(\w+)\}/g, (_, envVar) => {
		return process.env[envVar] || '';
	});
}
