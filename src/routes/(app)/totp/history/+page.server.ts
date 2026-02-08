import type { PageServerLoad } from './$types';
import { getDatabaseConfig, createDatabaseAdapter } from '$lib/server/database';
import * as m from '$lib/paraglide/messages';

export const load: PageServerLoad = async ({ url }) => {
    try {
        // Get limit from query params, default to 100
        const limit = parseInt(url.searchParams.get('limit') || '100');
        
        const dbConfig = await getDatabaseConfig();
        
        if (!dbConfig) {
            return {
                error: m.db_config_not_found(),
                storageType: null,
                history: []
            };
        }

        const dbInfo = dbConfig.type === 'sqlite'
            ? dbConfig.path ?? null
            : dbConfig.type === 'postgres' && dbConfig.postgres
                ? `PostgreSQL: ${dbConfig.postgres.host}:${dbConfig.postgres.port}/${dbConfig.postgres.database}`
                : null;

        const adapter = await createDatabaseAdapter(dbConfig);

        try {
            const history = await adapter.getTOTPHistory(limit);

            // Group history by username for better visualization
            const groupedHistory = history.reduce((acc, entry) => {
                if (!acc[entry.username]) {
                    acc[entry.username] = [];
                }
                acc[entry.username].push(entry);
                return acc;
            }, {} as Record<string, typeof history>);

            // Get statistics
            const stats = {
                totalEntries: history.length,
                uniqueUsers: Object.keys(groupedHistory).length,
                mostRecentUse: history[0]?.created_at || null,
                oldestEntry: history[history.length - 1]?.created_at || null
            };

            return {
                error: null,
                storageType: dbConfig.type,
                dbInfo,
                history,
                groupedHistory,
                stats,
                limit
            };
        } finally {
            await adapter.close();
        }
        
    } catch (error) {
        return {
            error: m.totp_history_load_failed({ error: (error as Error).message }),
            storageType: null,
            history: []
        };
    }
};