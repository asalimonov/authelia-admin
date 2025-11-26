import type { PageServerLoad, Actions } from './$types';
import { getDatabaseConfig, createDatabaseAdapter } from '$lib/server/database';
import { fail } from '@sveltejs/kit';
import { sanitizeString, isValidUsername } from '$lib/utils/validation';

export const load: PageServerLoad = async () => {
    try {
        const dbConfig = await getDatabaseConfig();
        
        if (!dbConfig) {
            return {
                error: 'Database configuration not found in Authelia config',
                storageType: null,
                bannedUsers: []
            };
        }
        
        if (dbConfig.type !== 'sqlite') {
            return {
                error: `Database type "${dbConfig.type}" is not yet supported. Only SQLite is currently supported.`,
                storageType: dbConfig.type,
                bannedUsers: []
            };
        }
        
        const adapter = await createDatabaseAdapter(dbConfig);
        
        try {
            const bannedUsers = await adapter.getBannedUsers();
            
            return {
                error: null,
                storageType: dbConfig.type,
                dbPath: dbConfig.path,
                bannedUsers
            };
        } finally {
            await adapter.close();
        }
        
    } catch (error) {
        return {
            error: `Failed to load banned users: ${(error as Error).message}`,
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
                return fail(400, { error: 'Username is required' });
            }
            
            if (!isValidUsername(username)) {
                return fail(400, { error: 'Invalid username format' });
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
                const success = await adapter.createBannedUser(username, expiresDate, source, sanitizedReason);
                
                if (!success) {
                    return fail(500, { error: `Failed to ban user "${username}"` });
                }
                
                return { success: true, message: `User "${username}" has been banned` };
            } finally {
                await adapter.close();
            }
            
        } catch (error) {
            console.error('Error creating banned user:', error);
            return fail(500, { error: `Failed to ban user: ${(error as Error).message}` });
        }
    },
    
    delete: async ({ request }) => {
        try {
            const formData = await request.formData();
            const id = formData.get('id')?.toString();
            const username = formData.get('username')?.toString();
            
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
                const success = await adapter.deleteBannedUser(parseInt(id));
                
                if (!success) {
                    return fail(404, { error: `Banned user record not found` });
                }
                
                return { success: true, message: `Ban for user "${username}" has been deleted` };
            } finally {
                await adapter.close();
            }
            
        } catch (error) {
            console.error('Error deleting banned user:', error);
            return fail(500, { error: `Failed to delete banned user: ${(error as Error).message}` });
        }
    }
};