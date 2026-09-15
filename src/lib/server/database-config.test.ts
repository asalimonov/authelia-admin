import type { PeerCertificate } from 'node:tls';
import { describe, it, expect } from 'vitest';
import {
	resolveDatabaseConfig,
	toPgSslOptions,
	parseAutheliaDuration,
	describeDatabaseConfig,
	DatabaseConfigError,
	type Env,
	type PostgresTlsConfig
} from './database-config';

const AUTHELIA_PATH = '/config/configuration.yml';

function reader(files: Record<string, string>) {
	return async (path: string): Promise<string> => {
		if (path in files) {
			return files[path];
		}
		const error = new Error(`ENOENT: ${path}`) as NodeJS.ErrnoException;
		error.code = 'ENOENT';
		throw error;
	};
}

function authelia(storage: string): Record<string, string> {
	return { [AUTHELIA_PATH]: `storage:\n  encryption_key: secret\n${storage}` };
}

async function resolve(env: Env, files: Record<string, string> = {}) {
	return resolveDatabaseConfig(env, reader(files));
}

async function resolvePostgres(env: Env, files: Record<string, string> = {}) {
	const { config } = await resolve(env, files);
	if (config?.type !== 'postgres') {
		throw new Error('expected postgres config');
	}
	return config.postgres;
}

async function expectInvalid(env: Env, files: Record<string, string>, message: RegExp) {
	const promise = resolve(env, files);
	await expect(promise).rejects.toBeInstanceOf(DatabaseConfigError);
	await expect(promise).rejects.toThrow(message);
}

const PG_FILE = authelia(
	[
		'  postgres:',
		"    address: 'tcp://db.internal:6543'",
		'    database: auth',
		'    schema: authelia_schema',
		'    username: auth_user',
		'    password: file-secret',
		"    timeout: '1m30s'"
	].join('\n')
);

describe('resolveDatabaseConfig', () => {
	describe('type selection', () => {
		it('returns null with a warning when nothing is configured', async () => {
			const { config, warnings } = await resolve({});
			expect(config).toBeNull();
			expect(warnings.join('\n')).toMatch(/No database configured/);
		});

		it('returns null when the Authelia file has no storage section', async () => {
			const { config } = await resolve({}, { [AUTHELIA_PATH]: 'theme: light\n' });
			expect(config).toBeNull();
		});

		it('detects SQLite from the Authelia file', async () => {
			const { config } = await resolve({}, authelia('  local:\n    path: /data/db.sqlite3\n'));
			expect(config).toEqual({ type: 'sqlite', sqlite: { path: '/data/db.sqlite3', busyTimeoutMs: 5000 } });
		});

		it('reads the Authelia file from AAD_AUTHELIA_CONFIG_PATH', async () => {
			const { config } = await resolve(
				{ AAD_AUTHELIA_CONFIG_PATH: '/custom.yml' },
				{ '/custom.yml': 'storage:\n  local:\n    path: /custom.sqlite3\n' }
			);
			expect(config).toMatchObject({ type: 'sqlite', sqlite: { path: '/custom.sqlite3' } });
		});

		it('accepts AAD_DB_TYPE case-insensitively', async () => {
			const { config } = await resolve({ AAD_DB_TYPE: ' sqlite ', AAD_DB_SQLITE_PATH: '/x.sqlite3' });
			expect(config).toMatchObject({ type: 'sqlite', sqlite: { path: '/x.sqlite3' } });
		});

		it('treats an empty AAD_DB_TYPE as unset', async () => {
			const { config } = await resolve({ AAD_DB_TYPE: '' }, authelia('  local:\n    path: /data/db.sqlite3\n'));
			expect(config?.type).toBe('sqlite');
		});

		it('rejects unknown AAD_DB_TYPE values', async () => {
			await expectInvalid({ AAD_DB_TYPE: 'postgres' }, {}, /AAD_DB_TYPE: "postgres" is not one of PG, SQLITE/);
		});

		it('switches backend when AAD_DB_TYPE differs from the file and ignores file values', async () => {
			const postgres = await resolvePostgres(
				{ AAD_DB_TYPE: 'PG', AAD_DB_PG_HOST: 'db' },
				authelia('  local:\n    path: /data/db.sqlite3\n')
			);
			expect(postgres).toMatchObject({ host: 'db', port: 5432, database: 'authelia', username: 'authelia' });
		});

		it('never infers the type from other variables', async () => {
			const { config, warnings } = await resolve(
				{ AAD_DB_PG_HOST: 'db' },
				authelia('  local:\n    path: /data/db.sqlite3\n')
			);
			expect(config?.type).toBe('sqlite');
			expect(warnings.join('\n')).toMatch(/AAD_DB_PG_HOST ignored: database type is SQLITE/);
		});

		it('warns about SQLite variables when the type is PG', async () => {
			const { warnings } = await resolve({ AAD_DB_TYPE: 'PG', AAD_DB_SQLITE_PATH: '/x' });
			expect(warnings.join('\n')).toMatch(/AAD_DB_SQLITE_PATH ignored: database type is PG/);
		});

		it('warns about unknown AAD_DB_ variables', async () => {
			const { warnings } = await resolve({ AAD_DB_TYPE: 'PG', AAD_DB_PG_TIMEOUT: '5000' });
			expect(warnings.join('\n')).toMatch(/Unknown database variables ignored: AAD_DB_PG_TIMEOUT/);
		});

		it('warns about unsupported Authelia storage backends', async () => {
			const { config, warnings } = await resolve({}, authelia('  mysql:\n    address: tcp://mysql:3306\n'));
			expect(config).toBeNull();
			expect(warnings.join('\n')).toMatch(/"mysql" is not supported/);
		});
	});

	describe('Authelia file errors', () => {
		it('rejects malformed YAML without echoing file content', async () => {
			const promise = resolve({}, { [AUTHELIA_PATH]: 'storage:\n  postgres:\n    password: "top-secret\n  : :' });
			await expect(promise).rejects.toThrow(/invalid YAML/);
			await expect(promise).rejects.not.toThrow(/top-secret/);
		});

		it('rejects an unreadable Authelia file', async () => {
			const readFile = async () => {
				const error = new Error('denied') as NodeJS.ErrnoException;
				error.code = 'EACCES';
				throw error;
			};
			await expect(resolveDatabaseConfig({}, readFile)).rejects.toThrow(/cannot read file \(EACCES\)/);
		});
	});

	describe('SQLite', () => {
		it('lets AAD_DB_SQLITE_PATH override the file path', async () => {
			const { config } = await resolve(
				{ AAD_DB_SQLITE_PATH: '/env.sqlite3' },
				authelia('  local:\n    path: /file.sqlite3\n')
			);
			expect(config).toMatchObject({ type: 'sqlite', sqlite: { path: '/env.sqlite3' } });
		});

		it('requires a path', async () => {
			await expectInvalid({ AAD_DB_TYPE: 'SQLITE' }, {}, /AAD_DB_SQLITE_PATH: required/);
		});

		it('parses AAD_DB_SQLITE_BUSY_TIMEOUT_MS', async () => {
			const { config } = await resolve({
				AAD_DB_TYPE: 'SQLITE',
				AAD_DB_SQLITE_PATH: '/x',
				AAD_DB_SQLITE_BUSY_TIMEOUT_MS: '250'
			});
			expect(config).toMatchObject({ sqlite: { busyTimeoutMs: 250 } });
		});

		it('rejects a busy timeout with a unit', async () => {
			await expectInvalid(
				{ AAD_DB_TYPE: 'SQLITE', AAD_DB_SQLITE_PATH: '/x', AAD_DB_SQLITE_BUSY_TIMEOUT_MS: '5s' },
				{},
				/AAD_DB_SQLITE_BUSY_TIMEOUT_MS: "5s" is not an integer/
			);
		});
	});

	describe('PostgreSQL fields', () => {
		it('uses defaults when only the type is set', async () => {
			const postgres = await resolvePostgres({ AAD_DB_TYPE: 'PG' });
			expect(postgres).toEqual({
				host: 'localhost',
				port: 5432,
				database: 'authelia',
				username: 'authelia',
				password: '',
				schema: 'public',
				timeoutMs: 5000,
				poolMax: 10,
				tls: { mode: 'disable', minVersion: 'TLSv1.2', maxVersion: 'TLSv1.3' }
			});
		});

		it('maps the Authelia file section', async () => {
			const postgres = await resolvePostgres({}, PG_FILE);
			expect(postgres).toMatchObject({
				host: 'db.internal',
				port: 6543,
				database: 'auth',
				username: 'auth_user',
				password: 'file-secret',
				schema: 'authelia_schema',
				timeoutMs: 90_000
			});
		});

		it('merges env over file per key', async () => {
			const postgres = await resolvePostgres({ AAD_DB_PG_PASSWORD: 'env-secret', AAD_DB_PG_PORT: '5433' }, PG_FILE);
			expect(postgres).toMatchObject({
				host: 'db.internal',
				port: 5433,
				database: 'auth',
				password: 'env-secret'
			});
		});

		it('parses addresses without scheme, with IPv6 and without port', async () => {
			expect(await resolvePostgres({}, authelia("  postgres:\n    address: 'pg:5555'\n"))).toMatchObject({
				host: 'pg',
				port: 5555
			});
			expect(await resolvePostgres({}, authelia("  postgres:\n    address: 'tcp://[fd00::1]:5432'\n"))).toMatchObject({
				host: 'fd00::1'
			});
			expect(await resolvePostgres({}, authelia("  postgres:\n    address: 'tcp://pg'\n"))).toMatchObject({
				host: 'pg',
				port: 5432
			});
		});

		it('supports legacy host and port fields', async () => {
			const postgres = await resolvePostgres({}, authelia('  postgres:\n    host: legacy\n    port: 5999\n'));
			expect(postgres).toMatchObject({ host: 'legacy', port: 5999 });
		});

		it('rejects unix addresses unless AAD_DB_PG_HOST overrides them', async () => {
			const file = authelia("  postgres:\n    address: 'unix:///var/run/postgres.sock'\n");
			await expectInvalid({}, file, /storage.postgres.address: scheme "unix" is not supported/);
			expect(await resolvePostgres({ AAD_DB_PG_HOST: 'pg' }, file)).toMatchObject({ host: 'pg', port: 5432 });
		});

		it('rejects an invalid port', async () => {
			await expectInvalid({ AAD_DB_TYPE: 'PG', AAD_DB_PG_PORT: 'abc' }, {}, /AAD_DB_PG_PORT: "abc" is not an integer 1..65535/);
			await expectInvalid({ AAD_DB_TYPE: 'PG', AAD_DB_PG_PORT: '70000' }, {}, /AAD_DB_PG_PORT/);
		});

		it('rejects an invalid schema', async () => {
			await expectInvalid({ AAD_DB_TYPE: 'PG', AAD_DB_PG_SCHEMA: 'public; drop' }, {}, /AAD_DB_PG_SCHEMA/);
		});

		it('parses AAD_DB_PG_TIMEOUT_MS and AAD_DB_PG_POOL_MAX', async () => {
			const postgres = await resolvePostgres(
				{ AAD_DB_PG_TIMEOUT_MS: '1500', AAD_DB_PG_POOL_MAX: '3' },
				PG_FILE
			);
			expect(postgres).toMatchObject({ timeoutMs: 1500, poolMax: 3 });
		});

		it('treats an integer Authelia timeout as seconds', async () => {
			const postgres = await resolvePostgres({}, authelia('  postgres:\n    address: tcp://pg\n    timeout: 5\n'));
			expect(postgres.timeoutMs).toBe(5000);
		});

		it('rejects invalid timeouts and pool sizes', async () => {
			await expectInvalid({ AAD_DB_TYPE: 'PG', AAD_DB_PG_TIMEOUT_MS: '5s' }, {}, /AAD_DB_PG_TIMEOUT_MS/);
			await expectInvalid({ AAD_DB_TYPE: 'PG', AAD_DB_PG_POOL_MAX: '0' }, {}, /AAD_DB_PG_POOL_MAX/);
			await expectInvalid(
				{},
				authelia('  postgres:\n    address: tcp://pg\n    timeout: soon\n'),
				/storage.postgres.timeout: "soon" is not a valid duration/
			);
		});

		it('warns that Authelia servers are ignored', async () => {
			const { warnings } = await resolve(
				{},
				authelia("  postgres:\n    address: tcp://pg\n    servers:\n      - address: 'tcp://pg2'\n")
			);
			expect(warnings.join('\n')).toMatch(/servers is not supported/);
		});
	});

	describe('PostgreSQL password', () => {
		it('reads AAD_DB_PG_PASSWORD_FILE and trims one trailing newline', async () => {
			const postgres = await resolvePostgres(
				{ AAD_DB_PG_PASSWORD_FILE: '/run/secrets/pg' },
				{ ...PG_FILE, '/run/secrets/pg': 'from-file \n' }
			);
			expect(postgres.password).toBe('from-file ');
		});

		it('rejects PASSWORD together with PASSWORD_FILE without echoing the password', async () => {
			const promise = resolve(
				{ AAD_DB_TYPE: 'PG', AAD_DB_PG_PASSWORD: 'hunter2', AAD_DB_PG_PASSWORD_FILE: '/run/secrets/pg' },
				{ '/run/secrets/pg': 'hunter3' }
			);
			await expect(promise).rejects.toThrow(/must not be set together/);
			await expect(promise).rejects.not.toThrow(/hunter/);
		});

		it('rejects an unreadable password file', async () => {
			await expectInvalid(
				{ AAD_DB_TYPE: 'PG', AAD_DB_PG_PASSWORD_FILE: '/missing' },
				{},
				/AAD_DB_PG_PASSWORD_FILE: cannot read "\/missing" \(ENOENT\)/
			);
		});
	});

	describe('PostgreSQL TLS', () => {
		const files = {
			'/ca.pem': 'CA',
			'/client.pem': 'CERT',
			'/client.key': 'KEY'
		};

		it('maps an Authelia tls block to verify-full', async () => {
			const postgres = await resolvePostgres(
				{},
				authelia(
					[
						'  postgres:',
						'    address: tcp://pg',
						'    tls:',
						'      server_name: pg.example',
						'      minimum_version: TLS1.3',
						'      certificate_chain: CHAIN',
						'      private_key: PRIVATE'
					].join('\n')
				)
			);
			expect(postgres.tls).toEqual({
				mode: 'verify-full',
				ca: undefined,
				cert: 'CHAIN',
				key: 'PRIVATE',
				serverName: 'pg.example',
				minVersion: 'TLSv1.3',
				maxVersion: 'TLSv1.3'
			});
		});

		it('maps Authelia skip_verify to require', async () => {
			const postgres = await resolvePostgres(
				{},
				authelia('  postgres:\n    address: tcp://pg\n    tls:\n      skip_verify: true\n')
			);
			expect(postgres.tls.mode).toBe('require');
		});

		it('lets AAD_DB_PG_TLS_MODE override the file', async () => {
			const postgres = await resolvePostgres(
				{ AAD_DB_PG_TLS_MODE: 'DISABLE' },
				authelia('  postgres:\n    address: tcp://pg\n    tls:\n      server_name: pg\n')
			);
			expect(postgres.tls).toEqual({ mode: 'disable', minVersion: 'TLSv1.2', maxVersion: 'TLSv1.3' });
		});

		it('reads CA, client certificate and key files', async () => {
			const postgres = await resolvePostgres(
				{
					AAD_DB_TYPE: 'PG',
					AAD_DB_PG_TLS_MODE: 'verify-ca',
					AAD_DB_PG_TLS_CA_FILE: '/ca.pem',
					AAD_DB_PG_TLS_CERT_FILE: '/client.pem',
					AAD_DB_PG_TLS_KEY_FILE: '/client.key',
					AAD_DB_PG_TLS_SERVER_NAME: 'pg-name'
				},
				files
			);
			expect(postgres.tls).toMatchObject({ mode: 'verify-ca', ca: 'CA', cert: 'CERT', key: 'KEY', serverName: 'pg-name' });
		});

		it('rejects an unknown mode', async () => {
			await expectInvalid({ AAD_DB_TYPE: 'PG', AAD_DB_PG_TLS_MODE: 'prefer' }, {}, /AAD_DB_PG_TLS_MODE: "prefer"/);
		});

		it('requires a CA for verify-ca', async () => {
			await expectInvalid(
				{ AAD_DB_TYPE: 'PG', AAD_DB_PG_TLS_MODE: 'verify-ca' },
				{},
				/verify-ca requires AAD_DB_PG_TLS_CA_FILE/
			);
		});

		it('requires certificate and key together', async () => {
			await expectInvalid(
				{ AAD_DB_TYPE: 'PG', AAD_DB_PG_TLS_MODE: 'verify-full', AAD_DB_PG_TLS_CERT_FILE: '/client.pem' },
				files,
				/must be set together/
			);
		});

		it('rejects an unreadable CA file', async () => {
			await expectInvalid(
				{ AAD_DB_TYPE: 'PG', AAD_DB_PG_TLS_MODE: 'verify-full', AAD_DB_PG_TLS_CA_FILE: '/nope.pem' },
				files,
				/AAD_DB_PG_TLS_CA_FILE: cannot read/
			);
		});

		it('ignores the CA with a warning in require mode', async () => {
			const { config, warnings } = await resolve(
				{ AAD_DB_TYPE: 'PG', AAD_DB_PG_TLS_MODE: 'require', AAD_DB_PG_TLS_CA_FILE: '/ca.pem' },
				files
			);
			expect(config?.type === 'postgres' && config.postgres.tls.ca).toBeUndefined();
			expect(warnings.join('\n')).toMatch(/AAD_DB_PG_TLS_CA_FILE ignored/);
		});

		it('warns about TLS variables when TLS is disabled and does not read files', async () => {
			const { warnings } = await resolve({
				AAD_DB_TYPE: 'PG',
				AAD_DB_PG_TLS_CA_FILE: '/nope.pem',
				AAD_DB_PG_TLS_SERVER_NAME: 'pg'
			});
			expect(warnings.join('\n')).toMatch(
				/AAD_DB_PG_TLS_CA_FILE, AAD_DB_PG_TLS_SERVER_NAME ignored: AAD_DB_PG_TLS_MODE is disable/
			);
		});

		it('validates TLS versions', async () => {
			await expectInvalid({ AAD_DB_TYPE: 'PG', AAD_DB_PG_TLS_MIN_VERSION: 'TLS1.0' }, {}, /AAD_DB_PG_TLS_MIN_VERSION/);
			await expectInvalid(
				{ AAD_DB_TYPE: 'PG', AAD_DB_PG_TLS_MIN_VERSION: 'TLS1.3', AAD_DB_PG_TLS_MAX_VERSION: 'tls1.2' },
				{},
				/minimum version TLSv1.3 is above maximum version TLSv1.2/
			);
		});
	});
});

describe('toPgSslOptions', () => {
	const base: PostgresTlsConfig = {
		mode: 'disable',
		ca: 'CA',
		cert: 'CERT',
		key: 'KEY',
		serverName: 'pg-name',
		minVersion: 'TLSv1.2',
		maxVersion: 'TLSv1.3'
	};

	it('returns false for disable', () => {
		expect(toPgSslOptions(base)).toBe(false);
	});

	it('never verifies in require mode', () => {
		const ssl = toPgSslOptions({ ...base, mode: 'require', ca: undefined });
		expect(ssl).toEqual({
			rejectUnauthorized: false,
			cert: 'CERT',
			key: 'KEY',
			servername: 'pg-name',
			minVersion: 'TLSv1.2',
			maxVersion: 'TLSv1.3'
		});
	});

	it('verifies the chain but not the host name in verify-ca mode', () => {
		const ssl = toPgSslOptions({ ...base, mode: 'verify-ca' });
		expect(ssl).toMatchObject({ rejectUnauthorized: true, ca: 'CA' });
		expect(ssl && ssl.checkServerIdentity?.('other', {} as never)).toBeUndefined();
	});

	it('verifies chain and host name in verify-full mode', () => {
		const ssl = toPgSslOptions({ ...base, mode: 'verify-full', serverName: undefined });
		expect(ssl).toEqual({
			rejectUnauthorized: true,
			ca: 'CA',
			cert: 'CERT',
			key: 'KEY',
			minVersion: 'TLSv1.2',
			maxVersion: 'TLSv1.3'
		});
	});

	it('verifies against the configured server name instead of the connect host', () => {
		const cert = { subject: { CN: 'pg-name' }, subjectaltname: 'DNS:pg-name' } as PeerCertificate;
		const matching = toPgSslOptions({ ...base, mode: 'verify-full' });
		const other = toPgSslOptions({ ...base, mode: 'verify-full', serverName: 'other' });
		expect(matching).toMatchObject({ rejectUnauthorized: true, servername: 'pg-name' });
		expect(matching && matching.checkServerIdentity?.('connect-host', cert)).toBeUndefined();
		expect(other && other.checkServerIdentity?.('pg-name', cert)).toBeInstanceOf(Error);
	});

	it('keeps rejectUnauthorized explicit without CA', () => {
		const ssl = toPgSslOptions({ mode: 'verify-full', minVersion: 'TLSv1.2', maxVersion: 'TLSv1.3' });
		expect(ssl).toEqual({ rejectUnauthorized: true, minVersion: 'TLSv1.2', maxVersion: 'TLSv1.3' });
	});
});

describe('parseAutheliaDuration', () => {
	it.each([
		[5, 5_000],
		['5', 5_000],
		['500ms', 500],
		['5s', 5_000],
		['1m30s', 90_000],
		['1h', 3_600_000],
		['1 hour and 30 minutes', 5_400_000],
		['2 days', 172_800_000]
	])('parses %s', (value, expected) => {
		expect(parseAutheliaDuration(value, 'timeout')).toBe(expected);
	});

	it.each(['', 'soon', '5x', '1.5h', '-1'])('rejects %s', (value) => {
		expect(() => parseAutheliaDuration(value, 'timeout')).toThrow(DatabaseConfigError);
	});
});

describe('describeDatabaseConfig', () => {
	it('describes SQLite and PostgreSQL', () => {
		expect(describeDatabaseConfig({ type: 'sqlite', sqlite: { path: '/db', busyTimeoutMs: 1 } })).toBe('SQLite /db');
		expect(
			describeDatabaseConfig({
				type: 'postgres',
				postgres: {
					host: 'pg',
					port: 5432,
					database: 'authelia',
					username: 'u',
					password: 'p',
					schema: 'public',
					timeoutMs: 1,
					poolMax: 1,
					tls: { mode: 'verify-full', minVersion: 'TLSv1.2', maxVersion: 'TLSv1.3' }
				}
			})
		).toBe('PostgreSQL pg:5432/authelia (TLS verify-full)');
	});
});
