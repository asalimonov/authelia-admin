import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
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

        const group = await directoryService.getGroupDetails(groupid);

        if (!group) {
            return {
                error: m.group_not_found({ groupId: groupid }),
                group: null,
                canEditGroup: false,
                canDeleteGroup: false,
                canAddMembers: false,
                canRemoveMembers: false,
                allUsers: [],
                userPermissions: {}
            };
        }

        // Check permissions
        const canEditGroup = await accessService.check(
            username,
            Permission.GROUP_EDIT,
            EntityType.GROUP,
            groupid
        );

        const canDeleteGroup = await accessService.check(
            username,
            Permission.GROUP_DELETE,
            EntityType.GROUP,
            groupid
        );

        const canAddMembers = await accessService.check(
            username,
            Permission.USER_ADD_TO_GROUP,
            EntityType.GROUP,
            groupid
        );

        const canRemoveMembers = await accessService.check(
            username,
            Permission.USER_REMOVE_FROM_GROUP,
            EntityType.GROUP,
            groupid
        );

        // If user can manage members, fetch all users with their groups
        let allUsers: { id: string; displayName: string; email: string }[] = [];
        const userPermissions: Record<string, { canAdd: boolean; canRemove: boolean }> = {};

        if (canAddMembers || canRemoveMembers) {
            // Check if current user is admin (admins can modify all users)
            const userRole = await accessService.getUserRole(username);
            const isAdmin = userRole === 'admin';

            // Fetch users with their groups in a single query
            const usersWithGroups = await directoryService.listUsersWithGroups();
            allUsers = usersWithGroups;

            // Check per-user permissions using already-fetched group data
            for (const user of usersWithGroups) {
                if (isAdmin) {
                    userPermissions[user.id] = { canAdd: true, canRemove: true };
                } else {
                    // Check if user is protected based on their groups
                    const groupNames = user.groups.map((g) => g.displayName);
                    const isProtected = accessService.isUserProtectedByGroups(groupNames);
                    userPermissions[user.id] = {
                        canAdd: canAddMembers && !isProtected,
                        canRemove: canRemoveMembers && !isProtected
                    };
                }
            }
        }

        return {
            error: null,
            group,
            canEditGroup,
            canDeleteGroup,
            canAddMembers,
            canRemoveMembers,
            allUsers,
            userPermissions
        };

    } catch (error) {
        console.error('Error loading group:', error);
        return {
            error: m.group_load_failed({ error: (error as Error).message }),
            group: null,
            canEditGroup: false,
            canDeleteGroup: false,
            canAddMembers: false,
            canRemoveMembers: false,
            allUsers: [],
            userPermissions: {}
        };
    }
};

export const actions: Actions = {
    deleteGroup: async ({ params, locals }) => {
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
            const canDeleteGroup = await accessService.check(
                username,
                Permission.GROUP_DELETE,
                EntityType.GROUP,
                groupid
            );

            if (!canDeleteGroup) {
                return fail(403, { error: m.group_delete_no_permission() });
            }

            // Check if group has members
            const group = await directoryService.getGroupDetails(groupid);
            if (group && group.members && group.members.length > 0) {
                return fail(400, { error: m.group_delete_has_members() });
            }

            const result = await directoryService.deleteGroup(groupid);

            if (!result.success) {
                return fail(500, { error: result.error || m.group_delete_failed() });
            }

            // Redirect to groups list after successful deletion
            throw redirect(303, `${base}/groups`);

        } catch (error) {
            // Re-throw redirects
            if (error instanceof Response || (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 303)) {
                throw error;
            }

            console.error('Error deleting group:', error);
            return fail(500, { error: m.group_delete_error({ error: (error as Error).message }) });
        }
    },

    addUser: async ({ request, params, locals }) => {
        const { groupid } = params;
        const username = locals.user?.username || '';

        try {
            const config = await getConfigAsync();
            const directoryService = await getDirectoryServiceAsync();
            const accessService = getAccessService(
                directoryService,
                config.directory.type as DirectoryServiceType
            );

            const formData = await request.formData();
            const userId = formData.get('userId')?.toString();

            if (!userId) {
                return fail(400, { error: m.validation_user_id_required() });
            }
            const canAddUser = await accessService.check(
                username,
                Permission.USER_ADD_TO_GROUP,
                EntityType.USER,
                userId
            );

            if (!canAddUser) {
                return fail(403, { error: m.group_add_user_no_permission() });
            }

            const result = await directoryService.addUserToGroup(userId, groupid);

            if (!result.success) {
                return fail(500, { error: result.error || m.group_add_user_failed() });
            }

            return {
                success: true,
                message: m.group_add_user_success(),
                type: 'membership'
            };

        } catch (error) {
            console.error('Error adding user to group:', error);
            return fail(500, { error: m.group_add_user_error({ error: (error as Error).message }) });
        }
    },

    removeUser: async ({ request, params, locals }) => {
        const { groupid } = params;
        const username = locals.user?.username || '';

        try {
            const config = await getConfigAsync();
            const directoryService = await getDirectoryServiceAsync();
            const accessService = getAccessService(
                directoryService,
                config.directory.type as DirectoryServiceType
            );

            const formData = await request.formData();
            const userId = formData.get('userId')?.toString();

            if (!userId) {
                return fail(400, { error: m.validation_user_id_required() });
            }
            const canRemoveUser = await accessService.check(
                username,
                Permission.USER_REMOVE_FROM_GROUP,
                EntityType.USER,
                userId
            );

            if (!canRemoveUser) {
                return fail(403, { error: m.group_remove_user_no_permission() });
            }

            const result = await directoryService.removeUserFromGroup(userId, groupid);

            if (!result.success) {
                return fail(500, { error: result.error || m.group_remove_user_failed() });
            }

            return {
                success: true,
                message: m.group_remove_user_success(),
                type: 'membership'
            };

        } catch (error) {
            console.error('Error removing user from group:', error);
            return fail(500, { error: m.group_remove_user_error({ error: (error as Error).message }) });
        }
    }
};
