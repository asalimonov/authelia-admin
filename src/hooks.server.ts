import type { Handle } from '@sveltejs/kit';
import { loadConfig, type AppConfig } from '$lib/server/config';

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

export const handle: Handle = async ({ event, resolve }) => {
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
		return new Response('Authentication required', {
			status: 403,
			headers: { 'Content-Type': 'text/plain' }
		});
	}

	try {
		const cookieHeader = event.request.headers.get('cookie') || '';
		const authResponse = await fetch(`https://${authelia.domain}/api/state`, {
			headers: {
				Cookie: cookieHeader,
				Accept: 'application/json'
			}
		});

		if (authResponse.status !== 200) {
			return new Response('Authentication required', {
				status: 403,
				headers: { 'Content-Type': 'text/plain' }
			});
		}

		const authData = await authResponse.json();

		// Check if response has expected structure
		if (authData.status !== 'OK' || !authData.data || !authData.data.username) {
			console.error('Invalid auth data structure:', authData);
			return new Response('Authentication failed', {
				status: 403,
				headers: { 'Content-Type': 'text/plain' }
			});
		}

		const username = authData.data.username;
		if (authelia.allowed_users != null && authelia.allowed_users.length > 0
			&& !authelia.allowed_users.includes(username)) {
			console.warn(`User ${username} not in allowed list`);
			return new Response('Access denied', {
				status: 403,
				headers: { 'Content-Type': 'text/plain' }
			});
		}

		// Check authentication level
		const authLevel = authData.data.authentication_level;
		if (typeof authLevel !== 'number' || authLevel < authelia.min_auth_level) {
			console.warn(`User ${username} has insufficient authentication level: ${authLevel}`);
			return new Response('Insufficient authentication level', {
				status: 403,
				headers: { 'Content-Type': 'text/plain' }
			});
		}

		event.locals.user = {
			username,
			authenticationLevel: authData.data.authentication_level
		};
	} catch (err) {
		console.error('Authentication check failed:', err);
		return new Response('Authentication failed', {
			status: 403,
			headers: { 'Content-Type': 'text/plain' }
		});
	}

	// Continue with the request - user is authenticated
	return resolve(event);
};
