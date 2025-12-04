import type { PageServerLoad } from './$types';
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
            config.directory.type as DirectoryServiceType
        );
        const username = locals.user?.username || '';
        canCreateUsers = await accessService.check(username, Permission.USER_CREATE, EntityType.NONE);
    } catch (err) {
        console.error('Error checking user create permission:', err);
    }

    try {
        const directoryService = await getDirectoryServiceAsync();
        const users = await directoryService.listUsers();

        // Sort users by id (username)
        users.sort((a, b) => a.id.localeCompare(b.id));

        return {
            error: null,
            users,
            canCreateUsers
        };
    } catch (error) {
        console.error('Error fetching users:', error);

        return {
            error: `Failed to fetch users: ${(error as Error).message}`,
            users: [],
            canCreateUsers
        };
    }
};