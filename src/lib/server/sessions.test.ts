import { describe, it, expect } from "vitest";
import { createCipheriv, randomBytes } from "node:crypto";
import { encode } from "@msgpack/msgpack";
import {
	decryptSessionBlob,
	parseUserSession,
	sessionEncryptionKey,
	sessionIdFromKey,
} from "./sessions";

/**
 * Encrypt like Authelia does (internal/utils/aes.go):
 * AES-256-GCM, key = SHA-256(secret), output = nonce|ciphertext|tag.
 */
function encryptLikeAuthelia(plaintext: Buffer, secret: string): Buffer {
	const key = sessionEncryptionKey(secret);
	const nonce = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key, nonce);
	const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
	return Buffer.concat([nonce, ciphertext, cipher.getAuthTag()]);
}

/**
 * Build a session blob like Authelia's Redis provider stores it:
 * msgpack Dict {KV: {UserSession: <JSON bytes>}} (fasthttp/session Dict),
 * encrypted with the EncryptingSerializer.
 */
function buildSessionBlob(
	userSession: Record<string, unknown>,
	secret: string,
): Buffer {
	const json = Buffer.from(JSON.stringify(userSession), "utf-8");
	const dict = encode({ KV: { UserSession: json } });
	return encryptLikeAuthelia(Buffer.from(dict), secret);
}

const SECRET = "insecure_session_secret_for_tests";

const USER_SESSION = {
	CookieDomain: "example.com",
	Username: "john",
	DisplayName: "John Doe",
	Groups: ["admins"],
	Emails: ["john@example.com"],
	KeepMeLoggedIn: true,
	LastActivity: 1751791000,
	FirstFactorAuthnTimestamp: 1751790000,
	SecondFactorAuthnTimestamp: 0,
};

describe("sessions", () => {
	describe("decryptSessionBlob + parseUserSession", () => {
		it("decrypts and parses an Authelia session blob", () => {
			const blob = buildSessionBlob(USER_SESSION, SECRET);

			const plaintext = decryptSessionBlob(blob, sessionEncryptionKey(SECRET));
			const session = parseUserSession(plaintext);

			expect(session.Username).toBe("john");
			expect(session.DisplayName).toBe("John Doe");
			expect(session.CookieDomain).toBe("example.com");
			expect(session.KeepMeLoggedIn).toBe(true);
			expect(session.LastActivity).toBe(1751791000);
			expect(session.FirstFactorAuthnTimestamp).toBe(1751790000);
		});

		it("parses an anonymous session (empty UserSession)", () => {
			const blob = buildSessionBlob({}, SECRET);

			const plaintext = decryptSessionBlob(blob, sessionEncryptionKey(SECRET));
			const session = parseUserSession(plaintext);

			expect(session.Username).toBeUndefined();
		});

		it("rejects data encrypted with a different secret", () => {
			const blob = buildSessionBlob(USER_SESSION, "another_secret");

			expect(() =>
				decryptSessionBlob(blob, sessionEncryptionKey(SECRET)),
			).toThrow();
		});

		it("rejects tampered ciphertext", () => {
			const blob = buildSessionBlob(USER_SESSION, SECRET);
			blob[20] ^= 0xff;

			expect(() =>
				decryptSessionBlob(blob, sessionEncryptionKey(SECRET)),
			).toThrow();
		});

		it("rejects truncated data", () => {
			expect(() =>
				decryptSessionBlob(Buffer.alloc(10), sessionEncryptionKey(SECRET)),
			).toThrow("malformed session ciphertext");
		});

		it("returns empty session when the Dict has no UserSession entry", () => {
			const dict = Buffer.from(encode({ KV: {} }));

			expect(parseUserSession(dict)).toEqual({});
		});
	});

	describe("sessionIdFromKey", () => {
		it("is deterministic and does not contain the token", () => {
			const key = "authelia-session:sometokenvalue";
			const id = sessionIdFromKey(key);

			expect(id).toMatch(/^[a-f0-9]{64}$/);
			expect(id).toBe(sessionIdFromKey(key));
			expect(id).not.toContain("sometokenvalue");
		});

		it("differs for different keys", () => {
			expect(sessionIdFromKey("authelia-session:a")).not.toBe(
				sessionIdFromKey("authelia-session:b"),
			);
		});
	});
});
