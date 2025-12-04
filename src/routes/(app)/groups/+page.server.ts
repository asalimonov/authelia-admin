import type { PageServerLoad } from './$types';
import { getDirectoryServiceAsync, type Group } from '$lib/server/directory-service';
import * as m from '$lib/paraglide/messages';

export const load: PageServerLoad = async () => {
    try {
        const directoryService = await getDirectoryServiceAsync();
        const groupSummaries = await directoryService.listGroups();

        // Fetch full details for each group to get members
        const groups: Group[] = [];
        for (const summary of groupSummaries) {
            const details = await directoryService.getGroupDetails(summary.id);
            if (details) {
                groups.push(details);
            }
        }

        // Sort groups by displayName
        groups.sort((a, b) => a.displayName.localeCompare(b.displayName));

        return {
            error: null,
            groups
        };
    } catch (error) {
        console.error('Error fetching groups:', error);

        return {
            error: m.groups_fetch_failed({ error: (error as Error).message }),
            groups: []
        };
    }
};