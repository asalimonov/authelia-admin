import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { sanitizeString } from '$lib/utils/validation';
import { getDirectoryServiceAsync } from '$lib/server/directory-service';
import { getAccessService, Permission, EntityType, type DirectoryServiceType } from '$lib/server/access-service';
import { getConfigAsync } from '$lib/server/config';
import * as m from '$lib/paraglide/messages';

export const load: PageServerLoad = async ({ params, locals }) => {
    const { groupid } = params;
    const username = locals.user?.username || '';

    try {
        const config = await getConfigAsync();
        const directoryService = await getDirectoryServiceAsync();
        const accessService = getAccessService(
            directoryService,
            config.directory.type as DirectoryServiceType
        );

        // Check if user can edit groups
        const canEditGroup = await accessService.check(
            username,
            Permission.GROUP_EDIT,
            EntityType.GROUP,
            groupid
        );

        if (!canEditGroup) {
            return {
                error: m.group_edit_no_permission(),
                group: null
            };
        }

        const group = await directoryService.getGroupDetails(groupid);

        if (!group) {
            return {
                error: m.group_not_found({ groupId: groupid }),
                group: null
            };
        }

        return {
            error: null,
            group
        };

    } catch (error) {
        console.error('Error loading group for edit:', error);
        return {
            error: m.group_load_failed({ error: (error as Error).message }),
            group: null
        };
    }
};

export const actions: Actions = {
    update: async ({ request, params, locals }) => {
        const { groupid } = params;
        const username = locals.user?.username || '';

        try {
            const config = await getConfigAsync();
            const directoryService = await getDirectoryServiceAsync();
            const accessService = getAccessService(
                directoryService,
                config.directory.type as DirectoryServiceType
            );

            // Check permission
            const canEditGroup = await accessService.check(
                username,
                Permission.GROUP_EDIT,
                EntityType.GROUP,
                groupid
            );

            if (!canEditGroup) {
                return fail(403, { error: m.group_edit_no_permission() });
            }

            const formData = await request.formData();
            const displayName = formData.get('displayName')?.toString()?.trim() || '';

            // Validate display name
            if (!displayName) {
                return fail(400, { error: m.validation_displayname_required() });
            }

            if (displayName.length > 255) {
                return fail(400, { error: m.validation_displayname_required() });
            }

            const result = await directoryService.updateGroup({
                id: groupid,
                displayName: sanitizeString(displayName, 255)
            });

            if (!result.success) {
                return fail(500, { error: result.error || m.group_update_failed() });
            }

            // Redirect to group detail page after successful update
            throw redirect(303, `${base}/groups/${groupid}`);

        } catch (error) {
            // Re-throw redirects
            if (error instanceof Response || (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 303)) {
                throw error;
            }

            console.error('Error updating group:', error);
            return fail(500, { error: m.group_update_error({ error: (error as Error).message }) });
        }
    }
};
