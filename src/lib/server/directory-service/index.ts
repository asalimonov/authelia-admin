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

// Configuration types
export type { LLDAPGraphQLConfig, ServiceConfig } from './config';
export { createLLDAPConfig } from './config';

// Factory
export { DirectoryServiceFactory } from './factory';

// Implementations (for direct use if needed)
export { LLDAPGraphQLService, LLDAPGraphQLClient } from './implementations/lldap-graphql';

// Singleton management
import type { IDirectoryService } from './types';
import type { LLDAPGraphQLConfig } from './config';
import { getConfigAsync } from '../config';
import { DirectoryServiceFactory } from './factory';

let directoryServiceInstance: IDirectoryService | null = null;
let initializationPromise: Promise<IDirectoryService> | null = null;

/**
 * Initialize and get the directory service singleton.
 * This lazy-initializes the service on first call using the centralized config.
 */
export async function initDirectoryService(): Promise<IDirectoryService> {
	if (directoryServiceInstance) {
		return directoryServiceInstance;
	}

	// Prevent multiple simultaneous initializations
	if (initializationPromise) {
		return initializationPromise;
	}

	initializationPromise = (async () => {
		try {
			const appConfig = await getConfigAsync();

			// Transform nested directory config to flat LLDAPGraphQLConfig
			const directoryConfig = appConfig.directory;
			const serviceConfig: LLDAPGraphQLConfig = {
				type: directoryConfig.type,
				...directoryConfig['lldap-graphql']
			};

			directoryServiceInstance = DirectoryServiceFactory.create(serviceConfig);
			return directoryServiceInstance;
		} finally {
			initializationPromise = null;
		}
	})();

	return initializationPromise;
}

/**
 * Get the directory service singleton.
 * Throws if not initialized - use initDirectoryService() for async initialization.
 */
export function getDirectoryService(): IDirectoryService {
	if (!directoryServiceInstance) {
		throw new Error(
			'DirectoryService not initialized. Call initDirectoryService() first or use getDirectoryServiceAsync().'
		);
	}
	return directoryServiceInstance;
}

/**
 * Get or initialize the directory service singleton (async version).
 */
export async function getDirectoryServiceAsync(): Promise<IDirectoryService> {
	return directoryServiceInstance || initDirectoryService();
}

/**
 * Reset the singleton (for testing purposes).
 */
export function resetDirectoryService(): void {
	directoryServiceInstance = null;
	initializationPromise = null;
}

/**
 * Set the directory service instance directly (for testing purposes).
 */
export function setDirectoryService(service: IDirectoryService): void {
	directoryServiceInstance = service;
}
