import type { PageServerLoad, Actions } from './$types';
import { getDatabaseConfig, createDatabaseAdapter } from '$lib/server/database';
import { fail } from '@sveltejs/kit';
import { sanitizeString, isValidUsername } from '$lib/utils/validation';
import * as m from '$lib/paraglide/messages';

export const load: PageServerLoad = async () => {
    try {
        const dbConfig = await getDatabaseConfig();
        
        if (!dbConfig) {
            return {
                error: m.db_config_not_found(),
                storageType: null,
                bannedUsers: []
            };
        }

        const dbInfo = dbConfig.type === 'sqlite'
            ? dbConfig.path ?? null
            : dbConfig.type === 'postgres' && dbConfig.postgres
                ? `PostgreSQL: ${dbConfig.postgres.host}:${dbConfig.postgres.port}/${dbConfig.postgres.database}`
                : null;

        const adapter = await createDatabaseAdapter(dbConfig);

        try {
            const bannedUsers = await adapter.getBannedUsers();

            return {
                error: null,
                storageType: dbConfig.type,
                dbInfo,
                bannedUsers
            };
        } finally {
            await adapter.close();
        }
        
    } catch (error) {
        return {
            error: m.banned_users_load_failed({ error: (error as Error).message }),
            storageType: null,
            bannedUsers: []
        };
    }
};

export const actions: Actions = {
    create: async ({ request }) => {
        try {
            const formData = await request.formData();
            const username = formData.get('username')?.toString();
            const expires = formData.get('expires')?.toString();
            const source = formData.get('source')?.toString() || 'admin';
            const reason = formData.get('reason')?.toString() || null;
            const isPermanent = formData.get('permanent') === 'true';
            
            if (!username) {
                return fail(400, { error: m.validation_username_required() });
            }

            if (!isValidUsername(username)) {
                return fail(400, { error: m.validation_username_invalid() });
            }

            const dbConfig = await getDatabaseConfig();

            if (!dbConfig) {
                return fail(500, { error: m.db_config_not_found() });
            }

            const adapter = await createDatabaseAdapter(dbConfig);

            try {
                let expiresDate: Date | null = null;
                if (!isPermanent && expires) {
                    expiresDate = new Date(expires);
                    if (isNaN(expiresDate.getTime())) {
                        return fail(400, { error: m.common_invalid_expiration_date() });
                    }
                }

                const sanitizedReason = reason ? sanitizeString(reason, 500) : null;
                const success = await adapter.createBannedUser(username, expiresDate, source, sanitizedReason);

                if (!success) {
                    return fail(500, { error: m.banned_user_ban_failed({ username }) });
                }

                return { success: true, message: m.banned_user_ban_success({ username }) };
            } finally {
                await adapter.close();
            }

        } catch (error) {
            console.error('Error creating banned user:', error);
            return fail(500, { error: m.banned_user_ban_error({ error: (error as Error).message }) });
        }
    },
    
    delete: async ({ request }) => {
        try {
            const formData = await request.formData();
            const id = formData.get('id')?.toString();
            const username = formData.get('username')?.toString();

            if (!id) {
                return fail(400, { error: m.common_ban_id_required() });
            }

            const dbConfig = await getDatabaseConfig();

            if (!dbConfig) {
                return fail(500, { error: m.db_config_not_found() });
            }

            const adapter = await createDatabaseAdapter(dbConfig);

            try {
                const success = await adapter.deleteBannedUser(parseInt(id));

                if (!success) {
                    return fail(404, { error: m.banned_user_not_found() });
                }

                return { success: true, message: m.banned_user_delete_success({ username: username || '' }) };
            } finally {
                await adapter.close();
            }

        } catch (error) {
            console.error('Error deleting banned user:', error);
            return fail(500, { error: m.banned_user_delete_error({ error: (error as Error).message }) });
        }
    }
};