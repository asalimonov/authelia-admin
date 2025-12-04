import { promises as fs } from 'fs';
import YAML from 'yaml';
import type { PageServerLoad } from './$types';
import * as m from '$lib/paraglide/messages';

export const load: PageServerLoad = async () => {
    try {
        // Read the Authelia configuration file
        const configPath = '/config/configuration.yml';
        const configContent = await fs.readFile(configPath, 'utf-8');
        
        // Parse the YAML configuration
        const config = YAML.parse(configContent);
        
        // Check if filesystem notifier is configured
        if (!config?.notifier?.filesystem) {
            return {
                error: m.notifications_not_configured(),
                hasNotifier: false,
                notifications: null,
                filename: null
            };
        }

        // Get the notification file path
        const notificationFilePath = config.notifier.filesystem.filename;

        if (!notificationFilePath) {
            return {
                error: m.notifications_path_not_specified(),
                hasNotifier: true,
                notifications: null,
                filename: null
            };
        }

        // Try to read the notification file
        let notifications = '';
        try {
            notifications = await fs.readFile(notificationFilePath, 'utf-8');
        } catch (err) {
            // File might not exist yet (no notifications sent)
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
                notifications = m.notifications_none_sent();
            } else {
                throw err;
            }
        }
        
        return {
            error: null,
            hasNotifier: true,
            notifications,
            filename: notificationFilePath
        };
        
    } catch (err) {
        return {
            error: m.notifications_config_read_failed({ error: (err as Error).message }),
            hasNotifier: false,
            notifications: null,
            filename: null
        };
    }
};