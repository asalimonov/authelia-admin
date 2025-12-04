import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { isValidEmail, sanitizeString } from '$lib/utils/validation';
import { getDirectoryServiceAsync, type UpdateUserInput } from '$lib/server/directory-service';
import { getAccessService, Permission, EntityType, type DirectoryServiceType } from '$lib/server/access-service';
import { getConfigAsync } from '$lib/server/config';
import * as m from '$lib/paraglide/messages';

export const load: PageServerLoad = async ({ params, locals }) => {
    const { userid } = params;
    const username = locals.user?.username || '';

    try {
        const config = await getConfigAsync();
        const directoryService = await getDirectoryServiceAsync();
        const accessService = getAccessService(
            directoryService,
            config.directory.type as DirectoryServiceType
        );

        // Check if user can edit users
        const canEditUser = await accessService.check(
            username,
            Permission.USER_EDIT,
            EntityType.USER,
            userid
        );

        if (!canEditUser) {
            return {
                error: m.user_edit_no_permission(),
                user: null,
                allGroups: [],
                canManageGroups: false
            };
        }

        const user = await directoryService.getUserDetails(userid);

        if (!user) {
            return {
                error: m.user_not_found({ userId: userid }),
                user: null,
                allGroups: [],
                canManageGroups: false
            };
        }

        // Check if user can manage group membership
        const canManageGroups = await accessService.check(
            username,
            Permission.USER_ADD_TO_GROUP,
            EntityType.GROUP
        );

        // Load all groups for membership management
        let allGroups: { id: string; displayName: string }[] = [];
        if (canManageGroups) {
            allGroups = await directoryService.listGroups();
        }

        return {
            error: null,
            user,
            allGroups,
            canManageGroups
        };

    } catch (error) {
        return {
            error: m.user_load_failed({ error: (error as Error).message }),
            user: null,
            allGroups: [],
            canManageGroups: false
        };
    }
};

export const actions: Actions = {
    updateDetails: async ({ request, params, locals }) => {
        const { userid } = params;
        const username = locals.user?.username || '';

        try {
            const config = await getConfigAsync();
            const directoryService = await getDirectoryServiceAsync();
            const accessService = getAccessService(
                directoryService,
                config.directory.type as DirectoryServiceType
            );

            // Check permission
            const canEditUser = await accessService.check(
                username,
                Permission.USER_EDIT,
                EntityType.USER,
                userid
            );

            if (!canEditUser) {
                return fail(403, { error: m.user_edit_no_permission() });
            }

            const formData = await request.formData();
            const displayName = formData.get('displayName')?.toString()?.trim() || '';
            const email = formData.get('email')?.toString()?.trim() || '';
            const firstName = formData.get('firstName')?.toString()?.trim() || '';
            const lastName = formData.get('lastName')?.toString()?.trim() || '';

            // Validate email
            if (email && !isValidEmail(email)) {
                return fail(400, { error: m.validation_email_invalid() });
            }

            // Build update input
            const updateInput: UpdateUserInput = {
                id: userid,
                email: email ? sanitizeString(email, 255) : undefined,
                displayName: displayName ? sanitizeString(displayName, 255) : undefined,
                insertAttributes: []
            };

            // Add first name and last name as attributes
            if (firstName) {
                updateInput.insertAttributes!.push({ name: 'first_name', values: [sanitizeString(firstName, 255)] });
            }
            if (lastName) {
                updateInput.insertAttributes!.push({ name: 'last_name', values: [sanitizeString(lastName, 255)] });
            }

            // Remove empty insertAttributes array
            if (updateInput.insertAttributes!.length === 0) {
                delete updateInput.insertAttributes;
            }

            const result = await directoryService.updateUser(updateInput);

            if (!result.success) {
                return fail(500, { error: result.error || m.user_update_failed() });
            }

            // Redirect to user detail page after successful update
            throw redirect(303, `${base}/users/${userid}`);

        } catch (error) {
            // Re-throw redirects
            if (error instanceof Response || (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 303)) {
                throw error;
            }

            console.error('Error updating user details:', error);
            return fail(500, { error: m.user_update_error({ error: (error as Error).message }) });
        }
    },

    addToGroup: async ({ request, params, locals }) => {
        const { userid } = params;
        const username = locals.user?.username || '';

        try {
            const config = await getConfigAsync();
            const directoryService = await getDirectoryServiceAsync();
            const accessService = getAccessService(
                directoryService,
                config.directory.type as DirectoryServiceType
            );

            // Check permission
            const canAddToGroup = await accessService.check(
                username,
                Permission.USER_ADD_TO_GROUP,
                EntityType.GROUP
            );

            if (!canAddToGroup) {
                return fail(403, { error: m.user_group_manage_no_permission() });
            }

            const formData = await request.formData();
            const groupId = formData.get('groupId')?.toString();

            if (!groupId) {
                return fail(400, { error: m.user_group_id_required() });
            }

            const result = await directoryService.addUserToGroup(userid, groupId);

            if (!result.success) {
                return fail(500, { error: result.error || m.user_add_to_group_failed() });
            }

            return {
                success: true,
                message: m.user_add_to_group_success(),
                type: 'membership'
            };

        } catch (error) {
            console.error('Error adding user to group:', error);
            return fail(500, { error: m.user_add_to_group_error({ error: (error as Error).message }) });
        }
    },

    removeFromGroup: async ({ request, params, locals }) => {
        const { userid } = params;
        const username = locals.user?.username || '';

        try {
            const config = await getConfigAsync();
            const directoryService = await getDirectoryServiceAsync();
            const accessService = getAccessService(
                directoryService,
                config.directory.type as DirectoryServiceType
            );

            // Check permission
            const canRemoveFromGroup = await accessService.check(
                username,
                Permission.USER_REMOVE_FROM_GROUP,
                EntityType.GROUP
            );

            if (!canRemoveFromGroup) {
                return fail(403, { error: m.user_group_manage_no_permission() });
            }

            const formData = await request.formData();
            const groupId = formData.get('groupId')?.toString();

            if (!groupId) {
                return fail(400, { error: m.user_group_id_required() });
            }

            const result = await directoryService.removeUserFromGroup(userid, groupId);

            if (!result.success) {
                return fail(500, { error: result.error || m.user_remove_from_group_failed() });
            }

            return {
                success: true,
                message: m.user_remove_from_group_success(),
                type: 'membership'
            };

        } catch (error) {
            console.error('Error removing user from group:', error);
            return fail(500, { error: m.user_remove_from_group_error({ error: (error as Error).message }) });
        }
    }
};
