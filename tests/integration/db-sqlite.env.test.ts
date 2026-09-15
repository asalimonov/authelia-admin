import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { expectHealth, expectStartupFailure, startAdmin } from './support/admin';
import { banIpThroughUi } from './support/http';
import { SQLITE_PATH, autheliaStorageYaml, startStack, type Stack } from './support/stack';

const SQLITE_ENV = { AAD_DB_TYPE: 'SQLITE', AAD_DB_SQLITE_PATH: SQLITE_PATH };

describe('SQLite database configuration via environment variables', () => {
	let stack: Stack;

	beforeAll(async () => {
		stack = await startStack('sqlite');
	});

	afterAll(async () => {
		await stack?.stop();
	});

	it('S1: connects with environment only, without Authelia configuration', async () => {
		await expectHealth(stack, { env: SQLITE_ENV, mountSqlite: true }, 200, /Using database: SQLite \/data\/db.sqlite3/);
	});

	it('S2: connects with Authelia configuration only', async () => {
		await expectHealth(
			stack,
			{ autheliaConfig: autheliaStorageYaml({ local: { path: SQLITE_PATH } }), mountSqlite: true },
			200
		);
	});

	it('S3: AAD_DB_SQLITE_PATH overrides the Authelia path', async () => {
		await expectHealth(
			stack,
			{
				env: { AAD_DB_SQLITE_PATH: SQLITE_PATH },
				autheliaConfig: autheliaStorageYaml({ local: { path: '/data/missing.sqlite3' } }),
				mountSqlite: true
			},
			200
		);
	});

	it('S4: accepts a lower-case AAD_DB_TYPE', async () => {
		await expectHealth(stack, { env: { ...SQLITE_ENV, AAD_DB_TYPE: 'sqlite' }, mountSqlite: true }, 200);
	});

	it('S5: exits on an unknown AAD_DB_TYPE', async () => {
		await expectStartupFailure(stack, { env: { ...SQLITE_ENV, AAD_DB_TYPE: 'postgres' } }, /AAD_DB_TYPE: "postgres"/);
	});

	it('S6: exits on a busy timeout with a unit', async () => {
		await expectStartupFailure(
			stack,
			{ env: { ...SQLITE_ENV, AAD_DB_SQLITE_BUSY_TIMEOUT_MS: '5s' } },
			/AAD_DB_SQLITE_BUSY_TIMEOUT_MS: "5s"/
		);
	});

	it('S7: exits when SQLITE has no path', async () => {
		await expectStartupFailure(stack, { env: { AAD_DB_TYPE: 'SQLITE' } }, /AAD_DB_SQLITE_PATH: required/);
	});

	it('S8: keeps running without any database configuration', async () => {
		await expectHealth(stack, {}, 500, /No database configured/);
	});

	it('S-T2: serves database pages through Traefik and Authelia with environment configuration', async () => {
		const admin = await startAdmin(stack, { env: SQLITE_ENV, mountSqlite: true });
		try {
			const { ip, action, page } = await banIpThroughUi(stack);
			const logs = await admin.logs();
			expect(action.status, logs).toBe(200);
			expect(JSON.parse(action.body).type, action.body).toBe('success');
			expect(page.status, logs).toBe(200);
			expect(page.body).toContain(ip);
		} finally {
			await admin.stop();
		}
	});
});
