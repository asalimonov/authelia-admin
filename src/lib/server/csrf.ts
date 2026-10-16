/** Runtime CSRF check for form submissions.
 *
 * SvelteKit's csrf.trustedOrigins is fixed when the app is built. A Debian
 * package or Docker image is built once, then installed on a host whose public
 * origin is different. TRUSTED_ORIGINS is therefore read on each request.
 * The Kit check is opened with trustedOrigins: ['*']; this module is the policy.
 */

const FORM_CONTENT_TYPES = [
	'application/x-www-form-urlencoded',
	'multipart/form-data',
	'text/plain',
	'application/x-sveltekit-formdata'
];

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Used when TRUSTED_ORIGINS is unset, matching the historical build default. */
export const DEFAULT_TRUSTED_ORIGINS = ['https://auth.localhost.test'];

export function trustedOriginsFromEnv(raw: string | undefined): string[] {
	if (raw == null || raw.trim() === '') {
		return DEFAULT_TRUSTED_ORIGINS;
	}
	return raw
		.split(',')
		.map((origin) => origin.trim())
		.filter((origin) => origin.length > 0);
}

export function isFormContentType(contentType: string | null): boolean {
	const type = contentType?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
	return FORM_CONTENT_TYPES.includes(type);
}

/** True when a mutating form post comes from an origin other than the app or TRUSTED_ORIGINS. */
export function isCrossSiteFormForbidden(
	method: string,
	contentType: string | null,
	requestOrigin: string | null,
	urlOrigin: string,
	trustedOrigins: readonly string[]
): boolean {
	if (!MUTATING_METHODS.has(method) || !isFormContentType(contentType)) {
		return false;
	}
	if (requestOrigin === urlOrigin) {
		return false;
	}
	return requestOrigin == null || !trustedOrigins.includes(requestOrigin);
}
