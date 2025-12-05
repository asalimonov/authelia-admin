import type { PageServerLoad } from './$types';
import { getDirectoryServiceAsync } from '$lib/server/directory-service';
import { getAccessService, Permission, EntityType, type DirectoryServiceType } from '$lib/server/access-service';
import { getConfigAsync } from '$lib/server/config';
import * as m from '$lib/paraglide/messages';

export const load: PageServerLoad = async ({ locals }) => {
    const username = locals.user?.username || '';

    try {
        const config = await getConfigAsync();
        const directoryService = await getDirectoryServiceAsync();
        const accessService = getAccessService(
            directoryService,
            config.directory.type as DirectoryServiceType
        );

        const groups = await directoryService.listGroups();

        // Sort groups by displayName
        groups.sort((a, b) => a.displayName.localeCompare(b.displayName));

        // Check if user can create groups
        const canCreateGroup = await accessService.check(
            username,
            Permission.GROUP_CREATE,
            EntityType.NONE
        );

        return {
            error: null,
            groups,
            canCreateGroup
        };
    } catch (error) {
        console.error('Error fetching groups:', error);

        return {
            error: m.groups_fetch_failed({ error: (error as Error).message }),
            groups: [],
            canCreateGroup: false
        };
    }
};