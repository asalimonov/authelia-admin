import type { Handle } from '@sveltejs/kit';

const AUTHELIA_DOMAIN = process.env.AUTHELIA_DOMAIN || 'auth.localhost.test';
const ALLOWED_USERS = process.env.ALLOWED_USERS ? process.env.ALLOWED_USERS.split(',') : ['admin'];
const MIN_AUTH_LEVEL = process.env.MIN_AUTH_LEVEL ? parseInt(process.env.MIN_AUTH_LEVEL) : 2;

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname === '/auth-admin/health') {
		return resolve(event);
	}

	const authSessionCookie = event.cookies.get('authelia_session');
		event.locals.user = undefined;	
	if (!authSessionCookie) {
		// No cookie - return 403 for all non-health endpoints
		return new Response('Authentication required', { 
			status: 403,
			headers: { 'Content-Type': 'text/plain' }
		});
	}

	try {
		const cookieHeader = event.request.headers.get('cookie') || '';
		const authResponse = await fetch(`https://${AUTHELIA_DOMAIN}/api/state`, {
			headers: {
				'Cookie': cookieHeader,
				'Accept': 'application/json'
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

		// Check if user is in allowed list
		const username = authData.data.username;
		if (!ALLOWED_USERS.includes(username)) {
			console.warn(`User ${username} not in allowed list`);
			return new Response('Access denied', { 
				status: 403,
				headers: { 'Content-Type': 'text/plain' }
			});
		}

		const authLevel = authData.data.authentication_level;
		if (typeof authLevel !== 'number' || authLevel < MIN_AUTH_LEVEL) {
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