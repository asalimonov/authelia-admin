/**
 * Centralized application configuration loader
 * Loads configuration from /opt/authelia-admin/config.yml (or configured path)
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

export interface DirectoryServiceConfig {
	type: 'lldap-graphql';
	endpoint: string;
	user: string;
	password: string;
}

export interface AppConfig {
	authelia: AutheliaConfig;
	directory_service: DirectoryServiceConfig;
}

// === Default Values ===

const DEFAULT_CONFIG_PATH = '/opt/authelia-admin/config.yml';

const DEFAULT_AUTHELIA_CONFIG: AutheliaConfig = {
	domain: 'auth.localhost.test',
	cookie_name: 'authelia_session',
	min_auth_level: 2,
	allowed_users: ['']
};

const DEFAULT_DIRECTORY_SERVICE_CONFIG: DirectoryServiceConfig = {
	type: 'lldap-graphql',
	endpoint: 'http://lldap:17170/api/graphql',
	user: 'admin',
	password: ''
};

// === Singleton State ===

let configInstance: AppConfig | null = null;
let configLoadPromise: Promise<AppConfig> | null = null;

// === Config Loading Functions ===

/**
 * Load and parse configuration from YAML file
 */
export async function loadConfig(
	configPath: string = process.env.CONFIG_PATH || DEFAULT_CONFIG_PATH
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
				directory_service: parseDirectoryServiceConfig(parsed?.directory_service)
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
	if (!config || typeof config !== 'object') {
		return loadAutheliaFromEnvironment();
	}

	const cfg = config as Record<string, unknown>;

	return {
		domain: substituteEnvVars(String(cfg.domain || DEFAULT_AUTHELIA_CONFIG.domain)),
		cookie_name: substituteEnvVars(
			String(cfg.cookie_name || DEFAULT_AUTHELIA_CONFIG.cookie_name)
		),
		min_auth_level: Number(cfg.min_auth_level ?? DEFAULT_AUTHELIA_CONFIG.min_auth_level),
		allowed_users: parseAllowedUsers(cfg.allowed_users)
	};
}

function parseDirectoryServiceConfig(config: unknown): DirectoryServiceConfig {
	if (!config || typeof config !== 'object') {
		return loadDirectoryServiceFromEnvironment();
	}

	const cfg = config as Record<string, unknown>;

	const type = String(cfg.type || 'lldap-graphql');
	if (type !== 'lldap-graphql') {
		throw new Error(`Unsupported directory service type: ${type}`);
	}

	return {
		type: 'lldap-graphql',
		endpoint: substituteEnvVars(String(cfg.endpoint || DEFAULT_DIRECTORY_SERVICE_CONFIG.endpoint)),
		user: substituteEnvVars(String(cfg.user || DEFAULT_DIRECTORY_SERVICE_CONFIG.user)),
		password: substituteEnvVars(String(cfg.password || DEFAULT_DIRECTORY_SERVICE_CONFIG.password))
	};
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
		authelia: loadAutheliaFromEnvironment(),
		directory_service: loadDirectoryServiceFromEnvironment()
	};
}

function loadAutheliaFromEnvironment(): AutheliaConfig {
	return {
		domain: process.env.AUTHELIA_DOMAIN || DEFAULT_AUTHELIA_CONFIG.domain,
		cookie_name: process.env.AUTHELIA_COOKIE_NAME || DEFAULT_AUTHELIA_CONFIG.cookie_name,
		min_auth_level: process.env.MIN_AUTH_LEVEL
			? parseInt(process.env.MIN_AUTH_LEVEL, 10)
			: DEFAULT_AUTHELIA_CONFIG.min_auth_level,
		allowed_users: process.env.ALLOWED_USERS
			? process.env.ALLOWED_USERS.split(',').map((u) => u.trim())
			: DEFAULT_AUTHELIA_CONFIG.allowed_users
	};
}

function loadDirectoryServiceFromEnvironment(): DirectoryServiceConfig {
	return {
		type: 'lldap-graphql',
		endpoint: process.env.LLDAP_ENDPOINT || DEFAULT_DIRECTORY_SERVICE_CONFIG.endpoint,
		user: process.env.LLDAP_USER || DEFAULT_DIRECTORY_SERVICE_CONFIG.user,
		password: process.env.LLDAP_PASSWORD || DEFAULT_DIRECTORY_SERVICE_CONFIG.password
	};
}

function substituteEnvVars(value: string): string {
	return value.replace(/\$\{(\w+)\}/g, (_, envVar) => {
		return process.env[envVar] || '';
	});
}
