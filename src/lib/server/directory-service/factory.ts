import type { IDirectoryService } from './types';
import type { DirectoryServiceConfig } from './config';
import { LLDAPGraphQLService } from './implementations/lldap-graphql';

/**
 * Factory for creating directory service instances.
 * Supports multiple implementations based on the 'type' field in configuration.
 */
export class DirectoryServiceFactory {
	/**
	 * Create a directory service instance based on configuration.
	 *
	 * @param config The directory service configuration
	 * @returns An instance of IDirectoryService
	 * @throws Error if the service type is not supported
	 */
	static create(config: DirectoryServiceConfig): IDirectoryService {
		switch (config.type) {
			case 'lldap-graphql':
				return new LLDAPGraphQLService(config);
			default:
				throw new Error(`Unsupported directory service type: ${config.type}`);
		}
	}
}
