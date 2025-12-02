import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { isValidEmail, sanitizeString } from '$lib/utils/validation';
import { getDirectoryServiceAsync, type UpdateUserInput } from '$lib/server/directory-service';
import { getAccessService, Permission, EntityType, type DirectoryServiceType } from '$lib/server/access-service';
import { getConfigAsync } from '$lib/server/config';

export const load: PageServerLoad = async ({ params, locals }) => {
    const { userid } = params;
    const username = locals.user?.username || '';

    try {
        const config = await getConfigAsync();
        const directoryService = await getDirectoryServiceAsync();
        const accessService = getAccessService(
            directoryService,
            config.directory_service.type as DirectoryServiceType
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
                error: 'You do not have permission to edit this user',
                user: null,
                allGroups: [],
                canManageGroups: false
            };
        }

        const user = await directoryService.getUserDetails(userid);

        if (!user) {
            return {
                error: `User "${userid}" not found`,
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
            error: `Failed to load user: ${(error as Error).message}`,
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
                config.directory_service.type as DirectoryServiceType
            );

            // Check permission
            const canEditUser = await accessService.check(
                username,
                Permission.USER_EDIT,
                EntityType.USER,
                userid
            );

            if (!canEditUser) {
                return fail(403, { error: 'You do not have permission to edit this user' });
            }

            const formData = await request.formData();
            const displayName = formData.get('displayName')?.toString()?.trim() || '';
            const email = formData.get('email')?.toString()?.trim() || '';
            const firstName = formData.get('firstName')?.toString()?.trim() || '';
            const lastName = formData.get('lastName')?.toString()?.trim() || '';

            // Validate email
            if (email && !isValidEmail(email)) {
                return fail(400, { error: 'Invalid email format' });
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
                return fail(500, { error: result.error || 'Failed to update user details' });
            }

            // Redirect to user detail page after successful update
            throw redirect(303, `${base}/users/${userid}`);

        } catch (error) {
            // Re-throw redirects
            if (error instanceof Response || (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 303)) {
                throw error;
            }

            console.error('Error updating user details:', error);
            return fail(500, { error: `Failed to update user: ${(error as Error).message}` });
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
                config.directory_service.type as DirectoryServiceType
            );

            // Check permission
            const canAddToGroup = await accessService.check(
                username,
                Permission.USER_ADD_TO_GROUP,
                EntityType.GROUP
            );

            if (!canAddToGroup) {
                return fail(403, { error: 'You do not have permission to manage group membership' });
            }

            const formData = await request.formData();
            const groupId = formData.get('groupId')?.toString();

            if (!groupId) {
                return fail(400, { error: 'Group ID is required' });
            }

            const result = await directoryService.addUserToGroup(userid, groupId);

            if (!result.success) {
                return fail(500, { error: result.error || 'Failed to add user to group' });
            }

            return {
                success: true,
                message: 'User added to group successfully',
                type: 'membership'
            };

        } catch (error) {
            console.error('Error adding user to group:', error);
            return fail(500, { error: `Failed to add user to group: ${(error as Error).message}` });
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
                config.directory_service.type as DirectoryServiceType
            );

            // Check permission
            const canRemoveFromGroup = await accessService.check(
                username,
                Permission.USER_REMOVE_FROM_GROUP,
                EntityType.GROUP
            );

            if (!canRemoveFromGroup) {
                return fail(403, { error: 'You do not have permission to manage group membership' });
            }

            const formData = await request.formData();
            const groupId = formData.get('groupId')?.toString();

            if (!groupId) {
                return fail(400, { error: 'Group ID is required' });
            }

            const result = await directoryService.removeUserFromGroup(userid, groupId);

            if (!result.success) {
                return fail(500, { error: result.error || 'Failed to remove user from group' });
            }

            return {
                success: true,
                message: 'User removed from group successfully',
                type: 'membership'
            };

        } catch (error) {
            console.error('Error removing user from group:', error);
            return fail(500, { error: `Failed to remove user from group: ${(error as Error).message}` });
        }
    }
};
