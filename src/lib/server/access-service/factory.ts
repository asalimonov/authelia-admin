import type { IDirectoryService } from '../directory-service';
import { AccessService, type IAccessService } from './access-service';
import { RoleMapperFactory, type DirectoryServiceType, type RoleMapperConfig } from './role-mapper';

let accessServiceInstance: IAccessService | null = null;

export interface CreateAccessServiceOptions {
    directoryService: IDirectoryService;
    directoryType: DirectoryServiceType;
    roleMapperConfig?: Partial<RoleMapperConfig>;
}

/**
 * Create an AccessService instance
 */
export function createAccessService(options: CreateAccessServiceOptions): IAccessService {
    const roleMapper = RoleMapperFactory.create(options.directoryType, options.roleMapperConfig);

    return new AccessService(options.directoryService, roleMapper);
}

/**
 * Get or create singleton AccessService instance
 */
export function getAccessService(
    directoryService?: IDirectoryService,
    directoryType?: DirectoryServiceType
): IAccessService {
    if (!accessServiceInstance) {
        if (!directoryService || !directoryType) {
            throw new Error(
                'AccessService not initialized. Provide directoryService and directoryType.'
            );
        }
        accessServiceInstance = createAccessService({
            directoryService,
            directoryType,
        });
    }
    return accessServiceInstance;
}

/**
 * Reset singleton (for testing)
 */
export function resetAccessService(): void {
    accessServiceInstance = null;
}
