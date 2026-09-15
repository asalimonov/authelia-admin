import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { expectHealth, expectStartupFailure, startAdmin, type AdminFile } from './support/admin';
import { banIpThroughUi } from './support/http';
import { PG, SQLITE_PATH, autheliaStorageYaml, startStack, type Stack } from './support/stack';

const CA = '/secrets/ca.pem';
const WRONG_CA = '/secrets/wrong-ca.pem';
const CLIENT_CERT = '/secrets/client.pem';
const CLIENT_KEY = '/secrets/client.key';
const PASSWORD_FILE = '/secrets/pg-password';

function pgEnv(overrides: Record<string, string | undefined> = {}): Record<string, string> {
	const env: Record<string, string | undefined> = {
		AAD_DB_TYPE: 'PG',
		AAD_DB_PG_HOST: PG.host,
		AAD_DB_PG_DATABASE: PG.database,
		AAD_DB_PG_USERNAME: PG.user,
		AAD_DB_PG_PASSWORD: PG.password,
		...overrides
	};
	return Object.fromEntries(
		Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined)
	);
}

describe('PostgreSQL database configuration via environment variables', () => {
	let stack: Stack;
	let files: AdminFile[];

	beforeAll(async () => {
		stack = await startStack('postgres');
		const certs = stack.certs!;
		files = [
			{ content: certs.ca, target: CA },
			{ content: certs.wrongCa, target: WRONG_CA },
			{ content: certs.clientCert, target: CLIENT_CERT },
			{ content: certs.clientKey, target: CLIENT_KEY },
			{ content: `${PG.password}\n`, target: PASSWORD_FILE }
		];
	});

	afterAll(async () => {
		await stack?.stop();
	});

	it('P0a: connects unencrypted with environment variables only and no TLS variables', async () => {
		await expectHealth(
			stack,
			{ env: pgEnv({ AAD_DB_PG_USERNAME: PG.plainUser, AAD_DB_PG_PASSWORD: PG.plainPassword }) },
			200,
			/Using database: PostgreSQL postgres-tls:5432\/authelia \(TLS disable\)/
		);
	});

	it('P0b: default without TLS variables is rejected by a TLS-only user', async () => {
		await expectHealth(stack, { env: pgEnv() }, 500, /no encryption/);
	});

	it('P1: disable connects a user allowed without TLS', async () => {
		await expectHealth(
			stack,
			{
				env: pgEnv({
					AAD_DB_PG_USERNAME: PG.plainUser,
					AAD_DB_PG_PASSWORD: PG.plainPassword,
					AAD_DB_PG_TLS_MODE: 'disable'
				})
			},
			200
		);
	});

	it('P2: disable is rejected for a TLS-only user', async () => {
		await expectHealth(stack, { env: pgEnv({ AAD_DB_PG_TLS_MODE: 'disable' }) }, 500, /no encryption/);
	});

	it('P3: require connects without certificate verification', async () => {
		await expectHealth(stack, { env: pgEnv({ AAD_DB_PG_TLS_MODE: 'require' }) }, 200);
	});

	it('P4: verify-ca ignores a host name that is not in the certificate', async () => {
		await expectHealth(
			stack,
			{
				env: pgEnv({
					AAD_DB_PG_HOST: PG.hostNotInCertificate,
					AAD_DB_PG_TLS_MODE: 'verify-ca',
					AAD_DB_PG_TLS_CA_FILE: CA
				}),
				files
			},
			200
		);
	});

	it('P5: verify-full connects with the right CA and host name', async () => {
		await expectHealth(
			stack,
			{ env: pgEnv({ AAD_DB_PG_TLS_MODE: 'verify-full', AAD_DB_PG_TLS_CA_FILE: CA }), files },
			200,
			/Using database: PostgreSQL postgres-tls:5432\/authelia \(TLS verify-full\)/
		);
	});

	it('P6: verify-full rejects an untrusted CA despite NODE_TLS_REJECT_UNAUTHORIZED=0', async () => {
		await expectHealth(
			stack,
			{ env: pgEnv({ AAD_DB_PG_TLS_MODE: 'verify-full', AAD_DB_PG_TLS_CA_FILE: WRONG_CA }), files },
			500,
			/self-signed certificate|unable to (get local issuer|verify)/
		);
	});

	it('P7a: verify-full rejects a host name that is not in the certificate', async () => {
		await expectHealth(
			stack,
			{
				env: pgEnv({
					AAD_DB_PG_HOST: PG.hostNotInCertificate,
					AAD_DB_PG_TLS_MODE: 'verify-full',
					AAD_DB_PG_TLS_CA_FILE: CA
				}),
				files
			},
			500,
			/does not match certificate's altnames/
		);
	});

	it('P7b: AAD_DB_PG_TLS_SERVER_NAME overrides the verified name', async () => {
		await expectHealth(
			stack,
			{
				env: pgEnv({
					AAD_DB_PG_HOST: PG.hostNotInCertificate,
					AAD_DB_PG_TLS_MODE: 'verify-full',
					AAD_DB_PG_TLS_CA_FILE: CA,
					AAD_DB_PG_TLS_SERVER_NAME: PG.host
				}),
				files
			},
			200
		);
	});

	it('P8a: client certificate authenticates a certificate-only user', async () => {
		await expectHealth(
			stack,
			{
				env: pgEnv({
					AAD_DB_PG_USERNAME: PG.mtlsUser,
					AAD_DB_PG_PASSWORD: undefined,
					AAD_DB_PG_TLS_MODE: 'verify-full',
					AAD_DB_PG_TLS_CA_FILE: CA,
					AAD_DB_PG_TLS_CERT_FILE: CLIENT_CERT,
					AAD_DB_PG_TLS_KEY_FILE: CLIENT_KEY
				}),
				files
			},
			200
		);
	});

	it('P8b: certificate-only user is rejected without a client certificate', async () => {
		await expectHealth(
			stack,
			{
				env: pgEnv({
					AAD_DB_PG_USERNAME: PG.mtlsUser,
					AAD_DB_PG_PASSWORD: undefined,
					AAD_DB_PG_TLS_MODE: 'verify-full',
					AAD_DB_PG_TLS_CA_FILE: CA
				}),
				files
			},
			500,
			/certificate/
		);
	});

	it('P9a: AAD_DB_PG_PASSWORD_FILE provides the password', async () => {
		await expectHealth(
			stack,
			{
				env: pgEnv({
					AAD_DB_PG_PASSWORD: undefined,
					AAD_DB_PG_PASSWORD_FILE: PASSWORD_FILE,
					AAD_DB_PG_TLS_MODE: 'require'
				}),
				files
			},
			200
		);
	});

	it('P9b: exits when PASSWORD and PASSWORD_FILE are both set without logging the password', async () => {
		await expectStartupFailure(
			stack,
			{ env: pgEnv({ AAD_DB_PG_PASSWORD_FILE: PASSWORD_FILE, AAD_DB_PG_TLS_MODE: 'require' }), files },
			/AAD_DB_PG_PASSWORD and AAD_DB_PG_PASSWORD_FILE must not be set together/,
			PG.password
		);
	});

	it('P10: environment password overrides a wrong password from the Authelia file', async () => {
		await expectHealth(
			stack,
			{
				env: { AAD_DB_PG_PASSWORD: PG.password, AAD_DB_PG_TLS_MODE: 'require' },
				autheliaConfig: autheliaStorageYaml({
					postgres: {
						address: `tcp://${PG.host}:5432`,
						database: PG.database,
						username: PG.user,
						password: 'wrong_password'
					}
				})
			},
			200
		);
	});

	it('P11: AAD_DB_TYPE=PG switches away from SQLite in the Authelia file', async () => {
		await expectHealth(
			stack,
			{
				env: pgEnv({ AAD_DB_PG_USERNAME: PG.plainUser, AAD_DB_PG_PASSWORD: PG.plainPassword }),
				autheliaConfig: autheliaStorageYaml({ local: { path: SQLITE_PATH } })
			},
			200
		);
	});

	it('P12: exits on verify-ca without a CA', async () => {
		await expectStartupFailure(
			stack,
			{ env: pgEnv({ AAD_DB_PG_TLS_MODE: 'verify-ca' }) },
			/verify-ca requires AAD_DB_PG_TLS_CA_FILE/
		);
	});

	it('P13: exits on an invalid port', async () => {
		await expectStartupFailure(stack, { env: pgEnv({ AAD_DB_PG_PORT: 'abc' }) }, /AAD_DB_PG_PORT: "abc"/);
	});

	it('P-T2: serves database pages through Traefik and Authelia with environment configuration', async () => {
		const admin = await startAdmin(stack, {
			env: pgEnv({ AAD_DB_PG_TLS_MODE: 'verify-full', AAD_DB_PG_TLS_CA_FILE: CA }),
			files
		});
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
