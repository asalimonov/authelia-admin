import { ApolloClient, InMemoryCache, gql, type DocumentNode } from '@apollo/client/core';
import { HttpLink } from '@apollo/client/link/http';
import fetch from 'cross-fetch';
import type { LLDAPGraphQLConfig } from '../../config';

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
			return cachedToken;
		}

		// If a refresh is already in progress, wait for it
		if (refreshPromise) {
			await refreshPromise;
			// Re-check token after waiting
			if (cachedToken && Date.now() < tokenExpiry - 30000) {
				return cachedToken;
			}
		}

		// Start a new refresh
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

		const response = await fetch(authUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				username: this.user,
				password: this.password
			})
		});

		if (!response.ok) {
			throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
		}

		const data = (await response.json()) as AuthResponse;

		if (!data.token) {
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

		const result = await client.query<T>({
			query: queryDoc,
			variables
		});

		if (result.errors && result.errors.length > 0) {
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

		const result = await client.mutate<T>({
			mutation: mutationDoc,
			variables
		});

		if (result.errors && result.errors.length > 0) {
			throw new Error(result.errors[0].message);
		}

		if (!result.data) {
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
