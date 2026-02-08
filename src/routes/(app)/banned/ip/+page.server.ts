import type { PageServerLoad, Actions } from './$types';
import { getDatabaseConfig, createDatabaseAdapter } from '$lib/server/database';
import { fail } from '@sveltejs/kit';
import { sanitizeString } from '$lib/utils/validation';
import * as m from '$lib/paraglide/messages';

export const load: PageServerLoad = async () => {
    try {
        const dbConfig = await getDatabaseConfig();
        
        if (!dbConfig) {
            return {
                error: m.db_config_not_found(),
                bannedIPs: []
            };
        }

        const adapter = await createDatabaseAdapter(dbConfig);

        try {
            const bannedIPs = await adapter.getBannedIPs();

            return {
                error: null,
                bannedIPs
            };
        } finally {
            await adapter.close();
        }
        
    } catch (error) {
        return {
            error: m.banned_ips_load_failed({ error: (error as Error).message }),
            bannedIPs: []
        };
    }
};

export const actions: Actions = {
    create: async ({ request }) => {
        try {
            const formData = await request.formData();
            const ip = formData.get('ip')?.toString();
            const expires = formData.get('expires')?.toString();
            const source = formData.get('source')?.toString() || 'admin';
            const reason = formData.get('reason')?.toString() || null;
            const isPermanent = formData.get('permanent') === 'true';
            
            if (!ip) {
                return fail(400, { error: m.banned_ip_required() });
            }
            
            // Basic IP validation (IPv4 or IPv6)
            const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
            const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
            
            if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
                return fail(400, { error: m.banned_ip_invalid_format() });
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
                const success = await adapter.createBannedIP(ip, expiresDate, source, sanitizedReason);
                
                if (!success) {
                    return fail(500, { error: m.banned_ip_ban_failed({ ip }) });
                }
                
                return { success: true, message: m.banned_ip_ban_success({ ip }) };
            } finally {
                await adapter.close();
            }
            
        } catch (error) {
            console.error('Error creating banned IP:', error);
            return fail(500, { error: m.banned_ip_ban_error({ error: (error as Error).message }) });
        }
    },
    
    delete: async ({ request }) => {
        try {
            const formData = await request.formData();
            const id = formData.get('id')?.toString();
            const ip = formData.get('ip')?.toString();
            
            if (!id) {
                return fail(400, { error: m.common_ban_id_required() });
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
                const success = await adapter.deleteBannedIP(numericId);
                
                if (!success) {
                    return fail(404, { error: m.banned_ip_not_found() });
                }
                
                return { success: true, message: m.banned_ip_delete_success({ ip: ip || '' }) };
            } finally {
                await adapter.close();
            }
            
        } catch (error) {
            console.error('Error deleting banned IP:', error);
            return fail(500, { error: m.banned_ip_delete_error({ error: (error as Error).message }) });
        }
    }
};