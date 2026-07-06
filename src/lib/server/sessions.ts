/**
 * Active session management via Authelia's Redis session storage.
 *
 * Authelia stores sessions in Redis under `authelia-session:<token>` where the
 * value is the msgpack-encoded fasthttp/session Dict, encrypted with
 * AES-256-GCM (key = SHA-256 of Authelia's session secret, layout
 * nonce|ciphertext|tag — see authelia internal/session/encrypting_serializer.go
 * and internal/utils/aes.go).
 *
 * This module lists those sessions (username, activity, expiry) and revokes
 * them by deleting the Redis keys, which logs the user out on their next
 * request.
 *
 * Requirements:
 * - Authelia must use the Redis session provider (session.redis in
 *   Authelia's configuration.yml, which this module reads).
 * - The session secret must be provided via AAD_AUTHELIA_SESSION_SECRET or
 *   AAD_AUTHELIA_SESSION_SECRET_FILE (same value as Authelia's
 *   AUTHELIA_SESSION_SECRET). Without it sessions cannot be decrypted and the
 *   feature is disabled.
 * - If the Redis password is not present in Authelia's configuration.yml
 *   (e.g. Authelia receives it via AUTHELIA_SESSION_REDIS_PASSWORD_FILE), it
 *   can be provided via AAD_SESSION_REDIS_PASSWORD or
 *   AAD_SESSION_REDIS_PASSWORD_FILE.
 */

import { promises as fs } from "node:fs";
import { createHash, createDecipheriv } from "node:crypto";
import { parse } from "yaml";
import { Redis } from "ioredis";
import { decode } from "@msgpack/msgpack";
import { createLogger } from "./logger";

const log = createLogger("sessions");

const SESSION_KEY_PREFIX = "authelia-session:";
const GCM_NONCE_LENGTH = 12;
const GCM_TAG_LENGTH = 16;
const SCAN_COUNT = 100;

export interface ActiveSession {
	/** Opaque identifier (SHA-256 of the Redis key). Never the session token itself. */
	id: string;
	username: string;
	displayName: string;
	cookieDomain: string;
	keepMeLoggedIn: boolean;
	/** Unix seconds, 0 if never active (anonymous session) */
	lastActivity: number;
	/** Unix seconds of first factor authentication, 0 if not authenticated */
	firstFactorAuthnTimestamp: number;
	/** Seconds until the session expires (Redis TTL), -1 if no expiry */
	expiresInSeconds: number;
}

export interface SessionsConfig {
	redis: {
		host: string;
		port: number;
		username?: string;
		password?: string;
		databaseIndex: number;
	};
	secret: string;
}

interface UserSessionData {
	Username?: string;
	DisplayName?: string;
	CookieDomain?: string;
	KeepMeLoggedIn?: boolean;
	LastActivity?: number;
	FirstFactorAuthnTimestamp?: number;
}

// === Configuration ===

// Cached config — Authelia config file doesn't change at runtime
let cachedConfigPromise: Promise<SessionsConfig | null> | null = null;

export async function getSessionsConfig(): Promise<SessionsConfig | null> {
	if (!cachedConfigPromise) {
		cachedConfigPromise = readSessionsConfig().catch((err) => {
			cachedConfigPromise = null;
			throw err;
		});
	}
	return cachedConfigPromise;
}

/** Reset cached config (for testing) */
export function resetSessionsConfig(): void {
	cachedConfigPromise = null;
}

async function readSecret(
	envValue: string | undefined,
	envFile: string | undefined,
): Promise<string | undefined> {
	if (envValue) {
		return envValue;
	}
	if (envFile) {
		return (await fs.readFile(envFile, "utf-8")).trim();
	}
	return undefined;
}

async function readSessionsConfig(): Promise<SessionsConfig | null> {
	try {
		const configPath =
			process.env.AAD_AUTHELIA_CONFIG_PATH ||
			process.env.AUTHELIA_CONFIG_PATH ||
			"/config/configuration.yml";
		const configContent = await fs.readFile(configPath, "utf-8");
		const config = parse(configContent);

		const redisConfig = config?.session?.redis;
		if (!redisConfig?.host) {
			log.info(
				"Authelia is not using the Redis session provider — session management disabled",
			);
			return null;
		}

		const secret = await readSecret(
			process.env.AAD_AUTHELIA_SESSION_SECRET,
			process.env.AAD_AUTHELIA_SESSION_SECRET_FILE,
		);
		if (!secret) {
			log.warn(
				"No session secret configured (AAD_AUTHELIA_SESSION_SECRET or AAD_AUTHELIA_SESSION_SECRET_FILE) — session management disabled",
			);
			return null;
		}

		const password =
			(await readSecret(
				process.env.AAD_SESSION_REDIS_PASSWORD,
				process.env.AAD_SESSION_REDIS_PASSWORD_FILE,
			)) ??
			(redisConfig.password ? String(redisConfig.password) : undefined);

		return {
			redis: {
				host: String(redisConfig.host),
				port: redisConfig.port ? Number(redisConfig.port) : 6379,
				username: redisConfig.username
					? String(redisConfig.username)
					: undefined,
				password,
				databaseIndex: redisConfig.database_index
					? Number(redisConfig.database_index)
					: 0,
			},
			secret,
		};
	} catch (error) {
		log.error("Error reading sessions configuration:", error);
		return null;
	}
}

// === Decryption and parsing (pure, exported for tests) ===

export function sessionEncryptionKey(secret: string): Buffer {
	return createHash("sha256").update(secret).digest();
}

/**
 * Decrypt an Authelia session blob (nonce|ciphertext|tag, AES-256-GCM).
 * Throws on tampered or foreign-key data.
 */
export function decryptSessionBlob(data: Buffer, key: Buffer): Buffer {
	if (data.length < GCM_NONCE_LENGTH + GCM_TAG_LENGTH) {
		throw new Error("malformed session ciphertext");
	}
	const nonce = data.subarray(0, GCM_NONCE_LENGTH);
	const ciphertext = data.subarray(
		GCM_NONCE_LENGTH,
		data.length - GCM_TAG_LENGTH,
	);
	const tag = data.subarray(data.length - GCM_TAG_LENGTH);

	const decipher = createDecipheriv("aes-256-gcm", key, nonce);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Parse the msgpack-encoded fasthttp/session Dict and extract Authelia's
 * UserSession JSON (stored under KV["UserSession"] as binary).
 */
export function parseUserSession(plaintext: Buffer): UserSessionData {
	const dict = decode(plaintext) as { KV?: Record<string, unknown> };
	const raw = dict?.KV?.["UserSession"];
	if (!(raw instanceof Uint8Array)) {
		return {};
	}
	return JSON.parse(new TextDecoder().decode(raw)) as UserSessionData;
}

export function sessionIdFromKey(redisKey: string): string {
	return createHash("sha256").update(redisKey).digest("hex");
}

// === Redis operations ===

function createRedisClient(config: SessionsConfig): Redis {
	return new Redis({
		host: config.redis.host,
		port: config.redis.port,
		username: config.redis.username,
		password: config.redis.password,
		db: config.redis.databaseIndex,
		lazyConnect: true,
		maxRetriesPerRequest: 2,
	});
}

async function scanSessionKeys(client: Redis): Promise<string[]> {
	const keys: string[] = [];
	let cursor = "0";
	do {
		const [next, batch] = await client.scan(
			cursor,
			"MATCH",
			`${SESSION_KEY_PREFIX}*`,
			"COUNT",
			SCAN_COUNT,
		);
		cursor = next;
		keys.push(...batch);
	} while (cursor !== "0");
	return keys;
}

/**
 * List all active Authelia sessions. Sessions that cannot be decrypted or
 * parsed (e.g. after a session secret rotation) are skipped.
 */
export async function listActiveSessions(): Promise<ActiveSession[]> {
	const config = await getSessionsConfig();
	if (!config) {
		throw new Error("Session management is not configured");
	}

	const key = sessionEncryptionKey(config.secret);
	const client = createRedisClient(config);
	try {
		const redisKeys = await scanSessionKeys(client);
		const sessions: ActiveSession[] = [];

		for (const redisKey of redisKeys) {
			const [blob, ttl] = await Promise.all([
				client.getBuffer(redisKey),
				client.ttl(redisKey),
			]);
			if (!blob || blob.length === 0) {
				continue;
			}
			try {
				const userSession = parseUserSession(decryptSessionBlob(blob, key));
				sessions.push({
					id: sessionIdFromKey(redisKey),
					username: userSession.Username || "",
					displayName: userSession.DisplayName || "",
					cookieDomain: userSession.CookieDomain || "",
					keepMeLoggedIn: userSession.KeepMeLoggedIn || false,
					lastActivity: userSession.LastActivity || 0,
					firstFactorAuthnTimestamp:
						userSession.FirstFactorAuthnTimestamp || 0,
					expiresInSeconds: ttl,
				});
			} catch (err) {
				log.warn(`Skipping undecryptable session ${redisKey}:`, err);
			}
		}

		// Most recently active first
		sessions.sort((a, b) => b.lastActivity - a.lastActivity);
		return sessions;
	} finally {
		client.disconnect();
	}
}

/**
 * Revoke a single session by its opaque id (SHA-256 of the Redis key).
 * Returns the number of deleted sessions (0 or 1).
 */
export async function revokeSession(id: string): Promise<number> {
	return revokeMatchingSessions(
		(redisKey) => sessionIdFromKey(redisKey) === id,
		false,
	);
}

/**
 * Revoke all sessions belonging to a username.
 * Returns the number of deleted sessions.
 */
export async function revokeUserSessions(username: string): Promise<number> {
	const config = await getSessionsConfig();
	if (!config) {
		throw new Error("Session management is not configured");
	}
	const key = sessionEncryptionKey(config.secret);

	return revokeMatchingSessions((redisKey, blob) => {
		if (!blob) {
			return false;
		}
		try {
			const userSession = parseUserSession(decryptSessionBlob(blob, key));
			return userSession.Username === username;
		} catch {
			return false;
		}
	}, true);
}

async function revokeMatchingSessions(
	matches: (redisKey: string, blob: Buffer | null) => boolean,
	needsBlob: boolean,
): Promise<number> {
	const config = await getSessionsConfig();
	if (!config) {
		throw new Error("Session management is not configured");
	}

	const client = createRedisClient(config);
	try {
		const redisKeys = await scanSessionKeys(client);
		let deleted = 0;
		for (const redisKey of redisKeys) {
			const blob = needsBlob ? await client.getBuffer(redisKey) : null;
			if (matches(redisKey, blob)) {
				deleted += await client.del(redisKey);
			}
		}
		return deleted;
	} finally {
		client.disconnect();
	}
}
