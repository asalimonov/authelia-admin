import type { PageServerLoad, Actions } from './$types';
import { getDatabaseConfig, createDatabaseAdapter } from '$lib/server/database';
import { fail } from '@sveltejs/kit';
import * as m from '$lib/paraglide/messages';

export const load: PageServerLoad = async () => {
    try {
        const dbConfig = await getDatabaseConfig();
        
        if (!dbConfig) {
            return {
                error: m.db_config_not_found(),
                configurations: []
            };
        }

        const adapter = await createDatabaseAdapter(dbConfig);

        try {
            const configurations = await adapter.getTOTPConfigurations();

            return {
                error: null,
                configurations: configurations.map(config => ({
                    ...config,
                    created_at: config.created_at,
                    last_used_at: config.last_used_at,
                    secret: '[ENCRYPTED]'
                }))
            };
        } finally {
            await adapter.close();
        }
        
    } catch (error) {
        return {
            error: m.totp_configs_load_failed({ error: (error as Error).message }),
            configurations: []
        };
    }
};

export const actions: Actions = {
    delete: async ({ request }) => {
        try {
            const formData = await request.formData();
            const id = formData.get('id')?.toString();
            const username = formData.get('username')?.toString();

            if (!id) {
                return fail(400, { error: m.totp_config_id_required() });
            }

            const numericId = parseInt(id, 10);
            if (isNaN(numericId)) {
                return fail(400, { error: m.common_invalid_id() });
            }

            const dbConfig = await getDatabaseConfig();

            if (!dbConfig) {
                return fail(500, { error: m.db_config_not_found() });
            }

            const adapter = await createDatabaseAdapter(dbConfig);

            try {
                const success = await adapter.deleteTOTPConfiguration(numericId);

                if (!success) {
                    return fail(404, { error: m.totp_config_not_found() });
                }

                return { success: true, message: m.totp_config_delete_success({ username: username || '' }) };
            } finally {
                await adapter.close();
            }

        } catch (error) {
            console.error('Error deleting TOTP configuration:', error);
            return fail(500, { error: m.totp_config_delete_error({ error: (error as Error).message }) });
        }
    }
};