import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { validatePassword } from '$lib/utils/validation';
import { getDirectoryServiceAsync } from '$lib/server/directory-service';
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

        const user = await directoryService.getUserDetails(userid);

        if (!user) {
            return {
                error: m.user_not_found({ userId: userid }),
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
            error: m.user_load_failed({ error: (error as Error).message }),
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
                config.directory.type as DirectoryServiceType
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
                return fail(403, { error: m.user_password_change_no_permission() });
            }

            const formData = await request.formData();
            const newPassword = formData.get('newPassword')?.toString();
            const repeatPassword = formData.get('repeatPassword')?.toString();

            if (!newPassword || !repeatPassword) {
                return fail(400, { error: m.validation_password_required() });
            }

            if (newPassword !== repeatPassword) {
                return fail(400, { error: m.validation_password_mismatch() });
            }

            // Validate password strength
            const passwordValidation = validatePassword(newPassword);
            if (!passwordValidation.isValid) {
                return fail(400, { error: passwordValidation.errors.join('. ') });
            }

            const result = await directoryService.changePassword(userid, newPassword);

            if (!result.success) {
                return fail(500, { error: result.error || m.user_password_change_failed() });
            }

            return {
                success: true,
                message: m.user_password_change_success(),
                type: 'password'
            };

        } catch (error) {
            console.error('Error changing password:', error);
            return fail(500, { error: m.user_password_change_error({ error: (error as Error).message }) });
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
                config.directory.type as DirectoryServiceType
            );

            // Check permission
            const canDeleteUser = await accessService.check(
                username,
                Permission.USER_DELETE,
                EntityType.USER,
                userid
            );

            if (!canDeleteUser) {
                return fail(403, { error: m.user_delete_no_permission() });
            }

            const result = await directoryService.deleteUser(userid);

            if (!result.success) {
                return fail(500, { error: result.error || m.user_delete_failed() });
            }

            // Redirect to users list after successful deletion
            throw redirect(303, `${base}/users`);

        } catch (error) {
            // Re-throw redirects
            if (error instanceof Response || (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 303)) {
                throw error;
            }

            console.error('Error deleting user:', error);
            return fail(500, { error: m.user_delete_error({ error: (error as Error).message }) });
        }
    }
};