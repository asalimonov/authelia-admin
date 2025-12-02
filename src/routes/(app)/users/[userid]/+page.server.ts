import type { PageServerLoad, Actions } from './$types';
import { ldapClient } from '$lib/server/ldap';
import { fail, redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { validatePassword } from '$lib/utils/validation';
import { getDirectoryServiceAsync } from '$lib/server/directory-service';
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

        const user = await directoryService.getUserDetails(userid);

        if (!user) {
            return {
                error: `User "${userid}" not found`,
                user: null,
                canEditUser: false,
                canDeleteUser: false,
                canChangePassword: false
            };
        }

        // Check if user can edit users
        const canEditUser = await accessService.check(
            username,
            Permission.USER_EDIT,
            EntityType.USER,
            userid
        );

        // Check if user can delete users
        const canDeleteUser = await accessService.check(
            username,
            Permission.USER_DELETE,
            EntityType.USER,
            userid
        );

        // Check if user can change password
        // Allow if: user has USER_CHANGE_PASSWORD permission for target user, OR it's their own account
        const isOwnAccount = username === userid;
        const hasPasswordPermission = await accessService.check(
            username,
            Permission.USER_CHANGE_PASSWORD,
            EntityType.USER,
            userid
        );
        const canChangePassword = isOwnAccount || hasPasswordPermission;

        return {
            error: null,
            user,
            canEditUser,
            canDeleteUser,
            canChangePassword
        };

    } catch (error) {
        return {
            error: `Failed to load user: ${(error as Error).message}`,
            user: null,
            canEditUser: false,
            canDeleteUser: false,
            canChangePassword: false
        };
    }
};

export const actions: Actions = {
    changePassword: async ({ request, params, locals }) => {
        const { userid } = params;
        const username = locals.user?.username || '';

        try {
            const config = await getConfigAsync();
            const directoryService = await getDirectoryServiceAsync();
            const accessService = getAccessService(
                directoryService,
                config.directory_service.type as DirectoryServiceType
            );

            // Check permission - allow if own account OR has USER_CHANGE_PASSWORD permission
            const isOwnAccount = username === userid;
            const hasPasswordPermission = await accessService.check(
                username,
                Permission.USER_CHANGE_PASSWORD,
                EntityType.USER,
                userid
            );

            if (!isOwnAccount && !hasPasswordPermission) {
                return fail(403, { error: 'You do not have permission to change this user\'s password' });
            }

            const formData = await request.formData();
            const newPassword = formData.get('newPassword')?.toString();
            const repeatPassword = formData.get('repeatPassword')?.toString();

            if (!newPassword || !repeatPassword) {
                return fail(400, { error: 'Password fields are required' });
            }

            if (newPassword !== repeatPassword) {
                return fail(400, { error: 'Passwords do not match' });
            }

            // Validate password strength
            const passwordValidation = validatePassword(newPassword);
            if (!passwordValidation.isValid) {
                return fail(400, { error: passwordValidation.errors.join('. ') });
            }

            const success = await ldapClient.changePassword(userid, newPassword);

            if (!success) {
                return fail(500, { error: 'Failed to change password' });
            }

            return {
                success: true,
                message: 'Password changed successfully',
                type: 'password'
            };

        } catch (error) {
            console.error('Error changing password:', error);
            return fail(500, { error: `Failed to change password: ${(error as Error).message}` });
        }
    },

    deleteUser: async ({ params, locals }) => {
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
            const canDeleteUser = await accessService.check(
                username,
                Permission.USER_DELETE,
                EntityType.USER,
                userid
            );

            if (!canDeleteUser) {
                return fail(403, { error: 'You do not have permission to delete this user' });
            }

            const result = await directoryService.deleteUser(userid);

            if (!result.success) {
                return fail(500, { error: result.error || 'Failed to delete user' });
            }

            // Redirect to users list after successful deletion
            throw redirect(303, `${base}/users`);

        } catch (error) {
            // Re-throw redirects
            if (error instanceof Response || (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 303)) {
                throw error;
            }

            console.error('Error deleting user:', error);
            return fail(500, { error: `Failed to delete user: ${(error as Error).message}` });
        }
    }
};