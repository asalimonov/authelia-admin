import { describe, expect, it } from 'vitest';
import {
	DEFAULT_TRUSTED_ORIGINS,
	isCrossSiteFormForbidden,
	trustedOriginsFromEnv
} from './csrf';

const APP = 'https://auth.example.com';

describe('trustedOriginsFromEnv', () => {
	it('keeps the local default when the variable is unset or blank', () => {
		expect(trustedOriginsFromEnv(undefined)).toEqual(DEFAULT_TRUSTED_ORIGINS);
		expect(trustedOriginsFromEnv('  ')).toEqual(DEFAULT_TRUSTED_ORIGINS);
	});

	it('splits a comma-separated list and drops empty entries', () => {
		expect(trustedOriginsFromEnv(' https://auth.example.com, https://admin.example.com, '))
			.toEqual(['https://auth.example.com', 'https://admin.example.com']);
	});

	it('does not treat * as every origin', () => {
		expect(trustedOriginsFromEnv('*')).toEqual(['*']);
		expect(isCrossSiteFormForbidden(
			'POST',
			'application/x-www-form-urlencoded',
			'https://evil.example',
			APP,
			trustedOriginsFromEnv('*')
		)).toBe(true);
	});
});

describe('isCrossSiteFormForbidden', () => {
	const trusted = ['https://auth.example.com'];

	it('allows a same-origin form post', () => {
		expect(isCrossSiteFormForbidden(
			'POST',
			'application/x-www-form-urlencoded',
			APP,
			APP,
			trusted
		)).toBe(false);
	});

	it('allows a form post from TRUSTED_ORIGINS when the public origin differs from the socket', () => {
		expect(isCrossSiteFormForbidden(
			'POST',
			'multipart/form-data; boundary=x',
			'https://auth.example.com',
			'http://127.0.0.1:9093',
			trusted
		)).toBe(false);
	});

	it('rejects a form post from any other origin', () => {
		expect(isCrossSiteFormForbidden(
			'POST',
			'text/plain',
			'https://evil.example',
			APP,
			trusted
		)).toBe(true);
	});

	it('rejects a form post with no Origin header', () => {
		expect(isCrossSiteFormForbidden(
			'DELETE',
			'application/x-sveltekit-formdata',
			null,
			APP,
			trusted
		)).toBe(true);
	});

	it('ignores JSON requests and safe methods', () => {
		expect(isCrossSiteFormForbidden('POST', 'application/json', 'https://evil.example', APP, trusted))
			.toBe(false);
		expect(isCrossSiteFormForbidden('GET', 'application/x-www-form-urlencoded', 'https://evil.example', APP, trusted))
			.toBe(false);
	});
});
