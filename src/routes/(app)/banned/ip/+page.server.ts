import type { PageServerLoad, Actions } from './$types';
import { getDatabaseConfig, createDatabaseAdapter } from '$lib/server/database';
import { fail } from '@sveltejs/kit';
import { sanitizeString } from '$lib/utils/validation';

export const load: PageServerLoad = async () => {
    try {
        const dbConfig = await getDatabaseConfig();
        
        if (!dbConfig) {
            return {
                error: 'Database configuration not found in Authelia config',
                storageType: null,
                bannedIPs: []
            };
        }
        
        if (dbConfig.type !== 'sqlite') {
            return {
                error: `Database type "${dbConfig.type}" is not yet supported. Only SQLite is currently supported.`,
                storageType: dbConfig.type,
                bannedIPs: []
            };
        }
        
        const adapter = await createDatabaseAdapter(dbConfig);
        
        try {
            const bannedIPs = await adapter.getBannedIPs();
            
            return {
                error: null,
                storageType: dbConfig.type,
                dbPath: dbConfig.path,
                bannedIPs
            };
        } finally {
            await adapter.close();
        }
        
    } catch (error) {
        return {
            error: `Failed to load banned IPs: ${(error as Error).message}`,
            storageType: null,
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
                return fail(400, { error: 'IP address is required' });
            }
            
            // Basic IP validation (IPv4 or IPv6)
            const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
            const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
            
            if (!ipv4Regex.test(ip) && !ipv6Regex.test(ip)) {
                return fail(400, { error: 'Invalid IP address format' });
            }
            
            const dbConfig = await getDatabaseConfig();
            
            if (!dbConfig) {
                return fail(500, { error: 'Database configuration not found' });
            }
            
            if (dbConfig.type !== 'sqlite') {
                return fail(501, { error: `Database type "${dbConfig.type}" is not yet supported` });
            }
            
            const adapter = await createDatabaseAdapter(dbConfig);
            
            try {
                let expiresDate: Date | null = null;
                if (!isPermanent && expires) {
                    expiresDate = new Date(expires);
                    if (isNaN(expiresDate.getTime())) {
                        return fail(400, { error: 'Invalid expiration date' });
                    }
                }
                
                const sanitizedReason = reason ? sanitizeString(reason, 500) : null;
                const success = await adapter.createBannedIP(ip, expiresDate, source, sanitizedReason);
                
                if (!success) {
                    return fail(500, { error: `Failed to ban IP "${ip}"` });
                }
                
                return { success: true, message: `IP "${ip}" has been banned` };
            } finally {
                await adapter.close();
            }
            
        } catch (error) {
            console.error('Error creating banned IP:', error);
            return fail(500, { error: `Failed to ban IP: ${(error as Error).message}` });
        }
    },
    
    delete: async ({ request }) => {
        try {
            const formData = await request.formData();
            const id = formData.get('id')?.toString();
            const ip = formData.get('ip')?.toString();
            
            if (!id) {
                return fail(400, { error: 'Ban ID is required' });
            }
            
            const dbConfig = await getDatabaseConfig();
            
            if (!dbConfig) {
                return fail(500, { error: 'Database configuration not found' });
            }
            
            if (dbConfig.type !== 'sqlite') {
                return fail(501, { error: `Database type "${dbConfig.type}" is not yet supported` });
            }
            
            const adapter = await createDatabaseAdapter(dbConfig);
            
            try {
                const success = await adapter.deleteBannedIP(parseInt(id));
                
                if (!success) {
                    return fail(404, { error: `Banned IP record not found` });
                }
                
                return { success: true, message: `Ban for IP "${ip}" has been deleted` };
            } finally {
                await adapter.close();
            }
            
        } catch (error) {
            console.error('Error deleting banned IP:', error);
            return fail(500, { error: `Failed to delete banned IP: ${(error as Error).message}` });
        }
    }
};