import { chmod, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	GenericContainer,
	Network,
	Wait,
	type StartedNetwork,
	type StartedTestContainer
} from 'testcontainers';
import { parse, stringify } from 'yaml';
import { generateCerts, type Certs } from './certs';
import { FIXTURES, IMAGES, ROOT } from './containers';

export type Storage = 'sqlite' | 'postgres';

export interface Stack {
	network: StartedNetwork;
	storage: Storage;
	sqliteDir?: string;
	certs?: Certs;
	traefikHost: string;
	traefikPort: number;
	stop(): Promise<void>;
}

export const PG = {
	host: 'postgres-tls',
	hostNotInCertificate: 'postgres-alt',
	database: 'authelia',
	user: 'authelia',
	password: 'authelia_test_password',
	plainUser: 'authelia_plain',
	plainPassword: 'plain_test_password',
	mtlsUser: 'authelia_mtls'
};

export const SQLITE_PATH = '/data/db.sqlite3';

const ENCRYPTION_KEY = 'a_very_important_secret';

export async function startStack(storage: Storage): Promise<Stack> {
	const network = await new Network().start();
	const containers: StartedTestContainer[] = [];
	let sqliteDir: string | undefined;

	const stop = async () => {
		for (const container of containers.reverse()) {
			await container.stop();
		}
		await network.stop();
		if (sqliteDir) {
			await rm(sqliteDir, { recursive: true, force: true });
		}
	};

	try {
		containers.push(await startLldap(network));

		let certs: Certs | undefined;
		if (storage === 'postgres') {
			certs = await generateCerts();
			containers.push(await startPostgres(network, certs));
		} else {
			sqliteDir = await mkdtemp(join(tmpdir(), 'aad-sqlite-'));
			await chmod(sqliteDir, 0o777);
		}

		containers.push(await startAuthelia(network, storage, certs, sqliteDir));

		const traefik = await startTraefik(network);
		containers.push(traefik);

		return {
			network,
			storage,
			sqliteDir,
			certs,
			traefikHost: traefik.getHost(),
			traefikPort: traefik.getMappedPort(443),
			stop
		};
	} catch (error) {
		await stop();
		throw error;
	}
}

export function autheliaStorageYaml(storage: Record<string, unknown>): string {
	return stringify({ storage: { encryption_key: ENCRYPTION_KEY, ...storage } });
}

async function startLldap(network: StartedNetwork): Promise<StartedTestContainer> {
	const container = await new GenericContainer(IMAGES.lldap)
		.withNetwork(network)
		.withNetworkAliases('lldap')
		.withEnvironment({
			TZ: 'UTC',
			LLDAP_LDAP_USER_EMAIL: 'admin@localhost',
			LLDAP_LDAP_USER_PASS: 'admin1234',
			LLDAP_JWT_SECRET: 'very_unsecure_jwt_secret_for_testing_only',
			LLDAP_KEY_SEED: 'very_unsecure_key_seed_for_testing_only',
			LLDAP_ADMIN_USERNAME: 'admin',
			LLDAP_ADMIN_PASSWORD: 'admin1234',
			USER_CONFIGS_DIR: '/bootstrap/user-configs',
			GROUP_CONFIGS_DIR: '/bootstrap/group-configs',
			USER_SCHEMAS_DIR: '/bootstrap/user-schemas',
			GROUP_SCHEMAS_DIR: '/bootstrap/group-schemas',
			DO_CLEANUP: 'false'
		})
		.withCopyDirectoriesToContainer([
			{ source: join(ROOT, 'test-configs/lldap/bootstrap'), target: '/bootstrap' }
		])
		.withCopyFilesToContainer([
			{ source: join(ROOT, 'test-configs/lldap/lldap_config.toml'), target: '/data/lldap_config.toml' }
		])
		.withExposedPorts(17170)
		.withWaitStrategy(Wait.forHttp('/', 17170))
		.withStartupTimeout(120_000)
		.start();

	const bootstrap = await container.exec(['bash', '/bootstrap/bootstrap.sh']);
	if (bootstrap.exitCode !== 0) {
		throw new Error(`LLDAP bootstrap failed:\n${bootstrap.output}`);
	}
	return container;
}

async function startPostgres(network: StartedNetwork, certs: Certs): Promise<StartedTestContainer> {
	const serverArgs = [
		'-c ssl=on',
		'-c ssl_cert_file=/certs/server.pem',
		'-c ssl_key_file=/certs/server.key',
		'-c ssl_ca_file=/certs/ca.pem',
		'-c hba_file=/etc/postgresql-test/pg_hba.conf'
	].join(' ');

	return new GenericContainer(IMAGES.postgres)
		.withNetwork(network)
		.withNetworkAliases(PG.host, PG.hostNotInCertificate)
		.withEnvironment({
			POSTGRES_DB: PG.database,
			POSTGRES_USER: PG.user,
			POSTGRES_PASSWORD: PG.password
		})
		.withCopyContentToContainer([
			{ content: certs.serverCert, target: '/certs-src/server.pem' },
			{ content: certs.serverKey, target: '/certs-src/server.key' },
			{ content: certs.ca, target: '/certs-src/ca.pem' }
		])
		.withCopyFilesToContainer([
			{ source: join(FIXTURES, 'postgres/pg_hba.conf'), target: '/etc/postgresql-test/pg_hba.conf', mode: 0o644 },
			{ source: join(FIXTURES, 'postgres/init.sql'), target: '/docker-entrypoint-initdb.d/init.sql', mode: 0o644 }
		])
		.withEntrypoint([
			'sh',
			'-c',
			'install -d -o postgres -g postgres -m 700 /certs' +
				' && install -o postgres -g postgres -m 600 /certs-src/* /certs/' +
				` && exec docker-entrypoint.sh postgres ${serverArgs}`
		])
		.withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
		.withStartupTimeout(120_000)
		.start();
}

async function startAuthelia(
	network: StartedNetwork,
	storage: Storage,
	certs: Certs | undefined,
	sqliteDir: string | undefined
): Promise<StartedTestContainer> {
	const config = parse(await readFile(join(ROOT, 'test-configs/authelia/configuration.yml'), 'utf-8'));
	delete config.log.file_path;
	config.notifier = { filesystem: { filename: '/tmp/notification.txt' } };

	if (storage === 'sqlite') {
		config.storage = { encryption_key: ENCRYPTION_KEY, local: { path: SQLITE_PATH } };
	} else {
		config.certificates_directory = '/certs';
		config.storage = {
			encryption_key: ENCRYPTION_KEY,
			postgres: {
				address: `tcp://${PG.host}:5432`,
				database: PG.database,
				schema: 'public',
				username: PG.user,
				password: PG.password,
				timeout: '5s',
				tls: { server_name: PG.host }
			}
		};
	}

	const contents = [{ content: stringify(config), target: '/config/configuration.yml' }];
	if (certs) {
		contents.push({ content: certs.ca, target: '/certs/ca.pem' });
	}

	let builder = new GenericContainer(IMAGES.authelia)
		.withNetwork(network)
		.withNetworkAliases('authelia')
		.withEnvironment({ TZ: 'UTC', PUID: '1001', PGID: '1001' })
		.withCopyContentToContainer(contents)
		.withExposedPorts(9091)
		.withWaitStrategy(Wait.forHttp('/api/health', 9091))
		.withStartupTimeout(120_000);

	if (sqliteDir) {
		builder = builder.withBindMounts([{ source: sqliteDir, target: '/data' }]);
	}
	return builder.start();
}

async function startTraefik(network: StartedNetwork): Promise<StartedTestContainer> {
	return new GenericContainer(IMAGES.traefik)
		.withNetwork(network)
		.withNetworkAliases('auth.localhost.test')
		.withCommand(['--configfile=/etc/traefik/traefik.yml'])
		.withCopyFilesToContainer([
			{ source: join(ROOT, 'test-configs/traefik-test/traefik.yml'), target: '/etc/traefik/traefik.yml' }
		])
		.withCopyDirectoriesToContainer([
			{ source: join(ROOT, 'test-configs/traefik-test/FileProvider'), target: '/FileProvider' }
		])
		.withExposedPorts(443)
		.withWaitStrategy(Wait.forListeningPorts())
		.withStartupTimeout(120_000)
		.start();
}
