import { sequence } from '@sveltejs/kit/hooks';
import { error, type Handle } from '@sveltejs/kit';
import { loadConfig, type AppConfig } from '$lib/server/config';
import { getDirectoryServiceAsync } from '$lib/server/directory-service';
import { getAccessService, type DirectoryServiceType } from '$lib/server/access-service';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { createLogger } from '$lib/server/logger';
import * as m from '$lib/paraglide/messages';

const log = createLogger('auth');

// Config will be loaded on first request
let configLoaded = false;
let config: AppConfig | null = null;

async function ensureConfigLoaded(): Promise<AppConfig> {
	if (!configLoaded) {
		config = await loadConfig();
		configLoaded = true;
	}
	return config!;
}

// i18n middleware using Paraglide
const i18nHandle: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
		event.request = localizedRequest;
		return resolve(event, {
			transformPageChunk: ({ html }) => {
				return html.replace('%lang%', locale);
			}
		});
	});

// Authentication middleware
const authHandle: Handle = async ({ event, resolve }) => {
	// Health endpoint doesn't require authentication
	if (event.url.pathname === '/auth-admin/health') {
		return resolve(event);
	}

	// Load config on first request
	const appConfig = await ensureConfigLoaded();
	const { authelia } = appConfig;

	// Check for session cookie using configured cookie name
	const authSessionCookie = event.cookies.get(authelia.cookie_name);
	event.locals.user = undefined;

	if (!authSessionCookie) {
		log.debug("Authentication cookie was not found")
		error(403, m.auth_required());
	}

	try {
		const cookieHeader = event.request.headers.get('cookie') || '';
		const authResponse = await fetch(`https://${authelia.domain}/api/state`, {
			headers: {
				Cookie: cookieHeader,
				Accept: 'application/json'
			}
		});

		log.debug("Authelia response:", authResponse)

		if (authResponse.status !== 200) {
			error(403, m.auth_required());
		}

		const authData = await authResponse.json();

		log.debug("Authelia response DATA:", authData)

		// Check if response has expected structure
		if (authData.status !== 'OK' || !authData.data || !authData.data.username) {
			log.error('Invalid auth data structure:', authData);
			error(403, m.auth_failed());
		}

		const username = authData.data.username;
		if (authelia.allowed_users != null && authelia.allowed_users.length > 0
			&& !authelia.allowed_users.includes(username)) {
			log.warn(`User ${username} not in allowed list`);
			error(403, m.common_access_denied());
		}

		// Check authentication level
		const authLevel = authData.data.authentication_level;
		if (typeof authLevel !== 'number' || authLevel < authelia.min_auth_level) {
			log.warn(`User ${username} has insufficient authentication level: ${authLevel}`);
			error(403, m.auth_level_insufficient());
		}

		event.locals.user = {
			username,
			authenticationLevel: authData.data.authentication_level
		};

		log.info("Got user's details:", username, authData.data.authentication_level)

		// Check if user has a valid role (admin, user_manager, or password_manager)
		// Users without a role cannot access the application
		try {
			const directoryService = await getDirectoryServiceAsync();
			const accessService = getAccessService(
				directoryService,
				appConfig.directory.type as DirectoryServiceType
			);

			const role = await accessService.getUserRole(username);
			if (role === null) {
				log.warn(`User ${username} does not have a valid role to access this application`);
				error(403, m.app_access_denied());
			}
			log.debug(`User ${username} authenticated with role ${role}`);
		} catch (roleErr) {
			log.error('Role check failed:', roleErr);
			// Re-throw SvelteKit errors
			if (roleErr && typeof roleErr === 'object' && 'status' in roleErr) {
				throw roleErr;
			}
			error(500, m.auth_check_failed());
		}
	} catch (err) {
		log.error('Authentication check failed:', err);
		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		error(403, m.auth_failed());
	}

	log.debug("Authentication succeded:", event.locals.user)
	// Continue with the request - user is authenticated and has a valid role
	return resolve(event);
};

// Export the combined handle with i18n first, then authentication
export const handle = sequence(i18nHandle, authHandle);
