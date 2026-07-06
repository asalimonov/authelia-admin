import type { PageServerLoad, Actions } from './$types';
import { fail } from '@sveltejs/kit';
import {
    getSessionsConfig,
    listActiveSessions,
    revokeSession,
    revokeUserSessions
} from '$lib/server/sessions';
import { getDirectoryServiceAsync } from '$lib/server/directory-service';
import { getAccessService, type DirectoryServiceType } from '$lib/server/access-service';
import { getConfigAsync } from '$lib/server/config';
import { isValidUsername } from '$lib/utils/validation';
import * as m from '$lib/paraglide/messages';

// Session revocation is admin-only: it terminates other users' access.
async function requireAdmin(username: string | undefined): Promise<boolean> {
    if (!username) {
        return false;
    }
    const appConfig = await getConfigAsync();
    const directoryService = await getDirectoryServiceAsync();
    const accessService = getAccessService(
        directoryService,
        appConfig.directory.type as DirectoryServiceType
    );
    const role = await accessService.getUserRole(username);
    return role === 'admin';
}

export const load: PageServerLoad = async ({ locals }) => {
    try {
        const config = await getSessionsConfig();
        if (!config) {
            return {
                enabled: false,
                isAdmin: false,
                error: null,
                sessions: []
            };
        }

        const isAdmin = await requireAdmin(locals.user?.username);
        if (!isAdmin) {
            return {
                enabled: true,
                isAdmin: false,
                error: m.common_access_denied(),
                sessions: []
            };
        }

        const sessions = await listActiveSessions();
        return {
            enabled: true,
            isAdmin: true,
            error: null,
            sessions
        };
    } catch (error) {
        return {
            enabled: true,
            isAdmin: false,
            error: m.sessions_load_failed({ error: (error as Error).message }),
            sessions: []
        };
    }
};

export const actions: Actions = {
    revoke: async ({ request, locals }) => {
        try {
            if (!(await requireAdmin(locals.user?.username))) {
                return fail(403, { error: m.common_access_denied() });
            }

            const formData = await request.formData();
            const id = formData.get('id')?.toString();
            if (!id || !/^[a-f0-9]{64}$/.test(id)) {
                return fail(400, { error: m.sessions_invalid_id() });
            }

            const deleted = await revokeSession(id);
            if (deleted === 0) {
                return fail(404, { error: m.sessions_not_found() });
            }
            return { success: true, revoked: deleted };
        } catch (error) {
            return fail(500, {
                error: m.sessions_revoke_failed({ error: (error as Error).message })
            });
        }
    },

    revokeUser: async ({ request, locals }) => {
        try {
            if (!(await requireAdmin(locals.user?.username))) {
                return fail(403, { error: m.common_access_denied() });
            }

            const formData = await request.formData();
            const username = formData.get('username')?.toString();
            if (!username || !isValidUsername(username)) {
                return fail(400, { error: m.validation_username_invalid() });
            }

            const deleted = await revokeUserSessions(username);
            return { success: true, revoked: deleted };
        } catch (error) {
            return fail(500, {
                error: m.sessions_revoke_failed({ error: (error as Error).message })
            });
        }
    }
};
