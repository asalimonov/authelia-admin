import { ApolloClient, InMemoryCache, gql, type DocumentNode } from '@apollo/client/core';
import { HttpLink } from '@apollo/client/link/http';
import fetch from 'cross-fetch';
import type { LLDAPGraphQLConfig } from '../../config';
import { createLogger } from '../../../logger';

const log = createLogger('lldap-client');

// Module-level token storage for thread-safe sharing across all requests
let cachedToken: string | null = null;
let tokenExpiry = 0;
let refreshPromise: Promise<string> | null = null;

interface AuthResponse {
	token: string;
}

/**
 * LLDAP GraphQL Client using Apollo Client
 *
 * Features:
 * - Thread-safe bearer token management at module level
 * - Automatic token refresh with mutex to prevent concurrent refresh attempts
 * - JWT expiry extraction with 30-second buffer
 */
export class LLDAPGraphQLClient {
	private endpoint: string;
	private user: string;
	private password: string;
	private client: ApolloClient<unknown> | null = null;

	constructor(config: LLDAPGraphQLConfig) {
		this.endpoint = config.endpoint;
		this.user = config.user;
		this.password = config.password;
	}

	/**
	 * Get or refresh the authentication token.
	 * Uses a Promise-based mutex to prevent concurrent refresh attempts.
	 */
	private async getToken(): Promise<string> {
		// Check if token is still valid (with 30-second buffer)
		if (cachedToken && Date.now() < tokenExpiry - 30000) {
			log.debug('Using cached token');
			return cachedToken;
		}

		// If a refresh is already in progress, wait for it
		if (refreshPromise) {
			log.debug('Waiting for token refresh in progress');
			await refreshPromise;
			// Re-check token after waiting
			if (cachedToken && Date.now() < tokenExpiry - 30000) {
				return cachedToken;
			}
		}

		// Start a new refresh
		log.debug('Starting token refresh');
		refreshPromise = this.refreshToken();

		try {
			const token = await refreshPromise;
			return token;
		} finally {
			refreshPromise = null;
		}
	}

	/**
	 * Perform the actual token refresh by calling LLDAP's auth endpoint.
	 */
	private async refreshToken(): Promise<string> {
		// Derive auth URL from GraphQL endpoint
		const authUrl = this.endpoint.replace('/api/graphql', '/auth/simple/login');

		log.debug(`Authenticating to LLDAP as user: ${this.user}`);

		const response = await fetch(authUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				username: this.user,
				password: this.password
			})
		});

		if (!response.ok) {
			log.error(`Authentication failed: ${response.status} ${response.statusText}`);
			throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
		}

		const data = (await response.json()) as AuthResponse;

		if (!data.token) {
			log.error('No token in authentication response');
			throw new Error('No token in authentication response');
		}

		cachedToken = data.token;

		// Extract expiry from JWT payload or use default 1-hour expiry
		try {
			const payload = JSON.parse(atob(data.token.split('.')[1]));
			if (payload.exp) {
				tokenExpiry = payload.exp * 1000; // Convert seconds to milliseconds
			} else {
				tokenExpiry = Date.now() + 3600000; // Default 1 hour
			}
		} catch {
			tokenExpiry = Date.now() + 3600000; // Default 1 hour on parse error
		}

		log.debug('Token refresh successful');
		return cachedToken;
	}

	/**
	 * Get or create the Apollo Client instance.
	 * Creates a new client with current token on each request to ensure fresh auth.
	 */
	private async getClient(): Promise<ApolloClient<unknown>> {
		const token = await this.getToken();

		// Always create a new client with fresh token to handle token refresh
		this.client = new ApolloClient({
			cache: new InMemoryCache(),
			link: new HttpLink({
				uri: this.endpoint,
				fetch,
				headers: {
					Authorization: `Bearer ${token}`
				}
			}),
			defaultOptions: {
				query: {
					fetchPolicy: 'no-cache'
				},
				mutate: {
					fetchPolicy: 'no-cache'
				}
			}
		});

		return this.client;
	}

	/**
	 * Execute a GraphQL query.
	 */
	async query<T>(queryString: string, variables?: Record<string, unknown>): Promise<T> {
		const client = await this.getClient();

		const queryDoc: DocumentNode = gql(queryString);

		log.debug('Executing GraphQL query:', queryDoc, variables);

		const result = await client.query<T>({
			query: queryDoc,
			variables
		});

		if (result.errors && result.errors.length > 0) {
			log.error('GraphQL query error:', result.errors[0].message);
			throw new Error(result.errors[0].message);
		}

		return result.data;
	}

	/**
	 * Execute a GraphQL mutation.
	 */
	async mutation<T>(mutationString: string, variables?: Record<string, unknown>): Promise<T> {
		const client = await this.getClient();

		const mutationDoc: DocumentNode = gql(mutationString);

		log.debug('Executing GraphQL mutation:', mutationDoc, variables);

		const result = await client.mutate<T>({
			mutation: mutationDoc,
			variables
		});

		if (result.errors && result.errors.length > 0) {
			log.error('GraphQL mutation error:', result.errors[0].message);
			throw new Error(result.errors[0].message);
		}

		if (!result.data) {
			log.error('No data in mutation response');
			throw new Error('No data in mutation response');
		}

		return result.data;
	}

	/**
	 * Clear the cached token. Useful for testing or forced re-authentication.
	 */
	static clearTokenCache(): void {
		cachedToken = null;
		tokenExpiry = 0;
		refreshPromise = null;
	}
}
