import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { sanitizeString } from '$lib/utils/validation';
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

        // Check if user has permission to create groups
        const result = await accessService.checkWithDetails(
            username,
            Permission.GROUP_CREATE,
            EntityType.NONE
        );

        if (!result.allowed) {
            return {
                error: result.reason || m.group_create_no_permission(),
                canCreate: false
            };
        }

        return {
            error: null,
            canCreate: true
        };
    } catch (error) {
        console.error('Error checking create group permission:', error);
        return {
            error: m.group_permissions_check_failed({ error: (error as Error).message }),
            canCreate: false
        };
    }
};

export const actions: Actions = {
    create: async ({ request, locals }) => {
        const username = locals.user?.username || '';

        try {
            const config = await getConfigAsync();
            const directoryService = await getDirectoryServiceAsync();
            const accessService = getAccessService(
                directoryService,
                config.directory.type as DirectoryServiceType
            );

            // Check permission again before creating
            const permissionCheck = await accessService.checkWithDetails(
                username,
                Permission.GROUP_CREATE,
                EntityType.NONE
            );

            if (!permissionCheck.allowed) {
                return fail(403, {
                    error: permissionCheck.reason || m.group_create_no_permission()
                });
            }

            const formData = await request.formData();
            const displayName = formData.get('displayName')?.toString()?.trim() || '';
            const action = formData.get('action')?.toString() || 'create';

            // Validation
            if (!displayName) {
                return fail(400, {
                    error: m.validation_displayname_required(),
                    values: { displayName }
                });
            }

            if (displayName.length > 255) {
                return fail(400, {
                    error: m.validation_displayname_required(),
                    values: { displayName }
                });
            }

            // Create the group
            const newGroup = await directoryService.createGroup({
                displayName: sanitizeString(displayName, 255)
            });

            if (action === 'createAndNew') {
                return {
                    success: true,
                    message: m.group_create_success({ displayName: newGroup.displayName }),
                    clearForm: true
                };
            }

            // Redirect to the new group's page
            throw redirect(303, `${base}/groups/${newGroup.id}`);
        } catch (error) {
            // Re-throw redirects
            if (error instanceof Response || (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 303)) {
                throw error;
            }

            console.error('Error creating group:', error);
            return fail(500, {
                error: m.group_create_error({ error: (error as Error).message })
            });
        }
    }
};
