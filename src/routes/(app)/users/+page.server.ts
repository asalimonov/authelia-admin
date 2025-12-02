import type { PageServerLoad } from './$types';
import { ldapClient } from '$lib/server/ldap';
import { getAccessService, Permission, EntityType, type DirectoryServiceType } from '$lib/server/access-service';
import { getDirectoryServiceAsync } from '$lib/server/directory-service';
import { getConfigAsync } from '$lib/server/config';

export const load: PageServerLoad = async ({ locals }) => {
    // Check if user can create users
    let canCreateUsers = false;
    try {
        const config = await getConfigAsync();
        const directoryService = await getDirectoryServiceAsync();
        const accessService = getAccessService(
            directoryService,
            config.directory_service.type as DirectoryServiceType
        );
        const username = locals.user?.username || '';
        canCreateUsers = await accessService.check(username, Permission.USER_CREATE, EntityType.NONE);
    } catch (err) {
        console.error('Error checking user create permission:', err);
    }

    try {
        const users = await ldapClient.getUsers();
        const ldapServer = await ldapClient.getServerInfo();

        // Sort users by username
        users.sort((a, b) => a.uid.localeCompare(b.uid));

        return {
            error: null,
            users,
            ldapServer,
            canCreateUsers
        };
    } catch (error) {
        console.error('Error fetching LDAP users:', error);
        const ldapServer = await ldapClient.getServerInfo();

        return {
            error: `Failed to fetch users from LDAP: ${(error as Error).message}`,
            users: [],
            ldapServer,
            canCreateUsers
        };
    }
};