import type { IRoleMapper, RoleMapperConfig } from './types';
import { LLDAPRoleMapper } from './implementations/lldap-role-mapper';

/**
 * Supported directory service types for role mapping
 */
export type DirectoryServiceType = 'lldap-graphql';

/**
 * Factory for creating role mappers based on directory service type
 */
export class RoleMapperFactory {
    /**
     * Create a role mapper for the specified directory service type
     * @param type - The directory service type
     * @param config - Optional custom configuration overrides
     */
    static create(type: DirectoryServiceType, config?: Partial<RoleMapperConfig>): IRoleMapper {
        switch (type) {
            case 'lldap-graphql':
                return new LLDAPRoleMapper(config);

            default:
                throw new Error(`Unsupported directory service type: ${type}`);
        }
    }

    /**
     * Create a role mapper from a DirectoryServiceConfig
     */
    static createFromConfig(
        directoryConfig: { type: string },
        roleMapperConfig?: Partial<RoleMapperConfig>
    ): IRoleMapper {
        return this.create(directoryConfig.type as DirectoryServiceType, roleMapperConfig);
    }
}
