import { promises as fs } from 'node:fs';
import { checkServerIdentity, type ConnectionOptions } from 'node:tls';
import { parse, YAMLParseError } from 'yaml';
import { createLogger } from './logger';

const log = createLogger('database-config');

export type TlsMode = 'disable' | 'require' | 'verify-ca' | 'verify-full';
export type TlsVersion = 'TLSv1.2' | 'TLSv1.3';

export interface PostgresTlsConfig {
	mode: TlsMode;
	ca?: string;
	cert?: string;
	key?: string;
	serverName?: string;
	minVersion: TlsVersion;
	maxVersion: TlsVersion;
}

export interface PostgresConfig {
	host: string;
	port: number;
	database: string;
	username: string;
	password: string;
	schema: string;
	timeoutMs: number;
	poolMax: number;
	tls: PostgresTlsConfig;
}

export interface SqliteConfig {
	path: string;
	busyTimeoutMs: number;
}

export type DatabaseConfig =
	| { type: 'sqlite'; sqlite: SqliteConfig }
	| { type: 'postgres'; postgres: PostgresConfig };

export type Env = Record<string, string | undefined>;
export type ReadFile = (path: string) => Promise<string>;

export interface DatabaseConfigResolution {
	config: DatabaseConfig | null;
	warnings: string[];
}

export class DatabaseConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'DatabaseConfigError';
	}
}

const DEFAULT_AUTHELIA_CONFIG_PATH = '/config/configuration.yml';

const SQLITE_ENV_KEYS = ['AAD_DB_SQLITE_PATH', 'AAD_DB_SQLITE_BUSY_TIMEOUT_MS'];

const PG_TLS_ENV_KEYS = [
	'AAD_DB_PG_TLS_MODE',
	'AAD_DB_PG_TLS_CA_FILE',
	'AAD_DB_PG_TLS_CERT_FILE',
	'AAD_DB_PG_TLS_KEY_FILE',
	'AAD_DB_PG_TLS_SERVER_NAME',
	'AAD_DB_PG_TLS_MIN_VERSION',
	'AAD_DB_PG_TLS_MAX_VERSION'
];

const PG_ENV_KEYS = [
	'AAD_DB_PG_HOST',
	'AAD_DB_PG_PORT',
	'AAD_DB_PG_DATABASE',
	'AAD_DB_PG_USERNAME',
	'AAD_DB_PG_PASSWORD',
	'AAD_DB_PG_PASSWORD_FILE',
	'AAD_DB_PG_SCHEMA',
	'AAD_DB_PG_TIMEOUT_MS',
	'AAD_DB_PG_POOL_MAX',
	...PG_TLS_ENV_KEYS
];

export const DATABASE_ENV_KEYS: readonly string[] = ['AAD_DB_TYPE', ...SQLITE_ENV_KEYS, ...PG_ENV_KEYS];

const TLS_MODES: readonly TlsMode[] = ['disable', 'require', 'verify-ca', 'verify-full'];

const TLS_VERSIONS: Record<string, TlsVersion> = {
	'TLS1.2': 'TLSv1.2',
	'TLS1.3': 'TLSv1.3'
};

const SCHEMA_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const DURATION_UNIT_MS: Record<string, number> = {
	ms: 1,
	s: 1_000,
	m: 60_000,
	h: 3_600_000,
	d: 86_400_000,
	w: 604_800_000,
	M: 2_592_000_000,
	y: 31_536_000_000
};

const DURATION_LONG_UNITS: Record<string, string> = {
	millisecond: 'ms',
	milliseconds: 'ms',
	second: 's',
	seconds: 's',
	minute: 'm',
	minutes: 'm',
	hour: 'h',
	hours: 'h',
	day: 'd',
	days: 'd',
	week: 'w',
	weeks: 'w',
	month: 'M',
	months: 'M',
	year: 'y',
	years: 'y'
};

interface Context {
	env: Env;
	readFile: ReadFile;
	warnings: string[];
}

type FileStorage =
	| { type: 'sqlite'; section: Record<string, unknown> }
	| { type: 'postgres'; section: Record<string, unknown> };

export async function resolveDatabaseConfig(env: Env, readFile: ReadFile): Promise<DatabaseConfigResolution> {
	const ctx: Context = { env, readFile, warnings: [] };

	const unknownKeys = Object.keys(env)
		.filter((key) => key.startsWith('AAD_DB_') && !DATABASE_ENV_KEYS.includes(key))
		.sort();
	if (unknownKeys.length > 0) {
		ctx.warnings.push(`Unknown database variables ignored: ${unknownKeys.join(', ')}`);
	}

	const envType = parseEnvType(env);
	const file = await readAutheliaStorage(ctx);
	const type = envType ?? file?.type;

	if (!type) {
		ctx.warnings.push(
			'No database configured: set AAD_DB_TYPE or provide a storage section in the Authelia configuration'
		);
		return { config: null, warnings: ctx.warnings };
	}

	const inactiveKeys = (type === 'sqlite' ? PG_ENV_KEYS : SQLITE_ENV_KEYS).filter(
		(key) => envValue(env, key, false) !== undefined
	);
	if (inactiveKeys.length > 0) {
		ctx.warnings.push(`${inactiveKeys.join(', ')} ignored: database type is ${typeName(type)}`);
	}

	const section = file?.type === type ? file.section : undefined;
	const config: DatabaseConfig =
		type === 'sqlite'
			? { type, sqlite: resolveSqlite(ctx, section) }
			: { type, postgres: await resolvePostgres(ctx, section) };

	return { config, warnings: ctx.warnings };
}

export function toPgSslOptions(tls: PostgresTlsConfig): false | ConnectionOptions {
	if (tls.mode === 'disable') {
		return false;
	}

	const options: ConnectionOptions = {
		minVersion: tls.minVersion,
		maxVersion: tls.maxVersion
	};
	if (tls.cert !== undefined && tls.key !== undefined) {
		options.cert = tls.cert;
		options.key = tls.key;
	}
	if (tls.serverName !== undefined) {
		options.servername = tls.serverName;
	}

	if (tls.mode === 'require') {
		return { ...options, rejectUnauthorized: false };
	}

	options.rejectUnauthorized = true;
	if (tls.ca !== undefined) {
		options.ca = tls.ca;
	}
	if (tls.mode === 'verify-ca') {
		options.checkServerIdentity = () => undefined;
	} else if (tls.serverName !== undefined) {
		// node-postgres replaces servername with the connect host, so the override is enforced here
		const serverName = tls.serverName;
		options.checkServerIdentity = (_host, cert) => checkServerIdentity(serverName, cert);
	}
	return options;
}

export function describeDatabaseConfig(config: DatabaseConfig): string {
	if (config.type === 'sqlite') {
		return `SQLite ${config.sqlite.path}`;
	}
	const { host, port, database, tls } = config.postgres;
	return `PostgreSQL ${host}:${port}/${database} (TLS ${tls.mode})`;
}

export function parseAutheliaDuration(value: unknown, label: string): number {
	if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
		return value * 1_000;
	}
	const text = typeof value === 'string' ? value : String(value);
	const compact = text.replace(/\band\b/g, '').replace(/\s+/g, '');
	if (/^\d+$/.test(compact)) {
		return Number(compact) * 1_000;
	}

	const block = /(\d+)(milliseconds?|seconds?|minutes?|hours?|days?|weeks?|months?|years?|ms|s|m|h|d|w|M|y)/y;
	let total = 0;
	let consumed = 0;
	let match: RegExpExecArray | null;
	while ((match = block.exec(compact)) !== null) {
		const unit = DURATION_LONG_UNITS[match[2]] ?? match[2];
		total += Number(match[1]) * DURATION_UNIT_MS[unit];
		consumed = block.lastIndex;
	}
	if (compact === '' || consumed !== compact.length) {
		throw new DatabaseConfigError(`${label}: "${text}" is not a valid duration`);
	}
	return total;
}

let resolution: Promise<DatabaseConfig | null> | null = null;

export function initDatabaseConfig(): Promise<DatabaseConfig | null> {
	if (!resolution) {
		resolution = resolveDatabaseConfig(process.env, (path) => fs.readFile(path, 'utf-8')).then(
			({ config, warnings }) => {
				for (const warning of warnings) {
					log.warn(warning);
				}
				if (config) {
					log.info(`Using database: ${describeDatabaseConfig(config)}`);
				}
				return config;
			},
			(error: unknown) => {
				log.error(`Invalid database configuration: ${(error as Error).message}`);
				throw error;
			}
		);
	}
	return resolution;
}

function parseEnvType(env: Env): DatabaseConfig['type'] | undefined {
	const raw = envValue(env, 'AAD_DB_TYPE');
	if (raw === undefined) {
		return undefined;
	}
	switch (raw.toUpperCase()) {
		case 'PG':
			return 'postgres';
		case 'SQLITE':
			return 'sqlite';
		default:
			throw new DatabaseConfigError(`AAD_DB_TYPE: "${raw}" is not one of PG, SQLITE`);
	}
}

async function readAutheliaStorage(ctx: Context): Promise<FileStorage | null> {
	const path =
		envValue(ctx.env, 'AAD_AUTHELIA_CONFIG_PATH') ??
		envValue(ctx.env, 'AUTHELIA_CONFIG_PATH') ??
		DEFAULT_AUTHELIA_CONFIG_PATH;

	let content: string;
	try {
		content = await ctx.readFile(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return null;
		}
		throw new DatabaseConfigError(`Authelia configuration "${path}": cannot read file (${errorCode(error)})`);
	}

	let parsed: unknown;
	try {
		parsed = parse(content);
	} catch (error) {
		const position =
			error instanceof YAMLParseError && error.linePos
				? ` at line ${error.linePos[0].line}, column ${error.linePos[0].col}`
				: '';
		throw new DatabaseConfigError(`Authelia configuration "${path}": invalid YAML${position}`);
	}

	const storage = asRecord(asRecord(parsed)?.storage);
	if (!storage) {
		return null;
	}
	const local = asRecord(storage.local);
	if (local) {
		return { type: 'sqlite', section: local };
	}
	const postgres = asRecord(storage.postgres);
	if (postgres) {
		return { type: 'postgres', section: postgres };
	}
	const other = Object.keys(storage).filter((key) => key !== 'encryption_key');
	if (other.length > 0) {
		ctx.warnings.push(`Authelia storage "${other.join(', ')}" is not supported`);
	}
	return null;
}

function resolveSqlite(ctx: Context, file: Record<string, unknown> | undefined): SqliteConfig {
	const path = envValue(ctx.env, 'AAD_DB_SQLITE_PATH') ?? fileString(file, 'path');
	if (path === undefined) {
		throw new DatabaseConfigError(
			'AAD_DB_SQLITE_PATH: required for database type SQLITE (not set in environment or Authelia storage.local.path)'
		);
	}
	const busyTimeout = envValue(ctx.env, 'AAD_DB_SQLITE_BUSY_TIMEOUT_MS');
	return {
		path,
		busyTimeoutMs:
			busyTimeout === undefined ? 5_000 : parseInteger(busyTimeout, 'AAD_DB_SQLITE_BUSY_TIMEOUT_MS', 0)
	};
}

async function resolvePostgres(ctx: Context, file: Record<string, unknown> | undefined): Promise<PostgresConfig> {
	const { env } = ctx;

	if (file?.servers !== undefined && file.servers !== null) {
		ctx.warnings.push('Authelia storage.postgres.servers is not supported and ignored');
	}

	const envHost = envValue(env, 'AAD_DB_PG_HOST');
	const envPort = envValue(env, 'AAD_DB_PG_PORT');
	const fileEndpoint = envHost !== undefined && envPort !== undefined ? {} : parseFileEndpoint(file, envHost);

	const host = envHost ?? fileEndpoint.host ?? 'localhost';
	const port = envPort !== undefined ? parseInteger(envPort, 'AAD_DB_PG_PORT', 1, 65_535) : (fileEndpoint.port ?? 5_432);

	const schemaFromEnv = envValue(env, 'AAD_DB_PG_SCHEMA');
	const schema = schemaFromEnv ?? fileString(file, 'schema') ?? 'public';
	if (!SCHEMA_PATTERN.test(schema)) {
		const label = schemaFromEnv !== undefined ? 'AAD_DB_PG_SCHEMA' : 'storage.postgres.schema';
		throw new DatabaseConfigError(`${label}: "${schema}" is not a valid schema name`);
	}

	const envTimeout = envValue(env, 'AAD_DB_PG_TIMEOUT_MS');
	const fileTimeout = file?.timeout;
	let timeoutMs = 5_000;
	if (envTimeout !== undefined) {
		timeoutMs = parseInteger(envTimeout, 'AAD_DB_PG_TIMEOUT_MS', 0);
	} else if (fileTimeout !== undefined && fileTimeout !== null && fileTimeout !== '') {
		timeoutMs = parseAutheliaDuration(fileTimeout, 'storage.postgres.timeout');
	}

	const envPoolMax = envValue(env, 'AAD_DB_PG_POOL_MAX');

	return {
		host,
		port,
		database: envValue(env, 'AAD_DB_PG_DATABASE') ?? fileString(file, 'database') ?? 'authelia',
		username: envValue(env, 'AAD_DB_PG_USERNAME') ?? fileString(file, 'username') ?? 'authelia',
		password: await resolvePassword(ctx, file),
		schema,
		timeoutMs,
		poolMax: envPoolMax === undefined ? 10 : parseInteger(envPoolMax, 'AAD_DB_PG_POOL_MAX', 1),
		tls: await resolveTls(ctx, asRecord(file?.tls))
	};
}

function parseFileEndpoint(
	file: Record<string, unknown> | undefined,
	envHost: string | undefined
): { host?: string; port?: number } {
	if (!file) {
		return {};
	}

	const address = fileString(file, 'address');
	if (address === undefined) {
		const port = file.port;
		return {
			host: fileString(file, 'host'),
			port:
				port === undefined || port === null || port === ''
					? undefined
					: parseInteger(port, 'storage.postgres.port', 1, 65_535)
		};
	}

	const scheme = /^([a-zA-Z][a-zA-Z0-9]*):\/\//.exec(address);
	const schemeName = scheme ? scheme[1].toLowerCase() : 'tcp';
	if (!['tcp', 'tcp4', 'tcp6'].includes(schemeName)) {
		if (envHost !== undefined) {
			return {};
		}
		throw new DatabaseConfigError(
			`storage.postgres.address: scheme "${schemeName}" is not supported (use tcp:// or set AAD_DB_PG_HOST)`
		);
	}

	let url: URL;
	try {
		url = new URL(`http://${address.slice(scheme ? scheme[0].length : 0)}`);
	} catch {
		throw new DatabaseConfigError(`storage.postgres.address: "${address}" is not a valid address`);
	}
	return {
		host: url.hostname.replace(/^\[(.*)\]$/, '$1'),
		port: url.port ? Number(url.port) : undefined
	};
}

async function resolvePassword(ctx: Context, file: Record<string, unknown> | undefined): Promise<string> {
	const password = envValue(ctx.env, 'AAD_DB_PG_PASSWORD', false);
	const passwordFile = envValue(ctx.env, 'AAD_DB_PG_PASSWORD_FILE');
	if (password !== undefined && passwordFile !== undefined) {
		throw new DatabaseConfigError('AAD_DB_PG_PASSWORD and AAD_DB_PG_PASSWORD_FILE must not be set together');
	}
	if (passwordFile !== undefined) {
		const content = await readEnvFile(ctx, 'AAD_DB_PG_PASSWORD_FILE', passwordFile);
		return content.replace(/\r?\n$/, '');
	}
	return password ?? fileString(file, 'password') ?? '';
}

async function resolveTls(ctx: Context, file: Record<string, unknown> | undefined): Promise<PostgresTlsConfig> {
	const { env } = ctx;

	const envMode = envValue(env, 'AAD_DB_PG_TLS_MODE');
	let mode: TlsMode;
	if (envMode !== undefined) {
		const normalized = envMode.toLowerCase() as TlsMode;
		if (!TLS_MODES.includes(normalized)) {
			throw new DatabaseConfigError(
				`AAD_DB_PG_TLS_MODE: "${envMode}" is not one of ${TLS_MODES.join(', ')}`
			);
		}
		mode = normalized;
	} else if (file) {
		mode = file.skip_verify === true || file.skip_verify === 'true' ? 'require' : 'verify-full';
	} else {
		mode = 'disable';
	}

	const minVersion = resolveTlsVersion(ctx, 'AAD_DB_PG_TLS_MIN_VERSION', file, 'minimum_version', 'TLSv1.2');
	const maxVersion = resolveTlsVersion(ctx, 'AAD_DB_PG_TLS_MAX_VERSION', file, 'maximum_version', 'TLSv1.3');
	if (minVersion > maxVersion) {
		throw new DatabaseConfigError(`TLS minimum version ${minVersion} is above maximum version ${maxVersion}`);
	}

	if (mode === 'disable') {
		const ignored = PG_TLS_ENV_KEYS.filter(
			(key) => key !== 'AAD_DB_PG_TLS_MODE' && envValue(env, key) !== undefined
		);
		if (ignored.length > 0) {
			ctx.warnings.push(`${ignored.join(', ')} ignored: AAD_DB_PG_TLS_MODE is disable`);
		}
		return { mode, minVersion, maxVersion };
	}

	const caPath = envValue(env, 'AAD_DB_PG_TLS_CA_FILE');
	const certPath = envValue(env, 'AAD_DB_PG_TLS_CERT_FILE');
	const keyPath = envValue(env, 'AAD_DB_PG_TLS_KEY_FILE');

	let ca = caPath !== undefined ? await readEnvFile(ctx, 'AAD_DB_PG_TLS_CA_FILE', caPath) : undefined;
	const cert =
		certPath !== undefined
			? await readEnvFile(ctx, 'AAD_DB_PG_TLS_CERT_FILE', certPath)
			: fileString(file, 'certificate_chain');
	const key =
		keyPath !== undefined
			? await readEnvFile(ctx, 'AAD_DB_PG_TLS_KEY_FILE', keyPath)
			: fileString(file, 'private_key');

	if ((cert === undefined) !== (key === undefined)) {
		throw new DatabaseConfigError(
			'TLS client certificate and private key must be set together (AAD_DB_PG_TLS_CERT_FILE, AAD_DB_PG_TLS_KEY_FILE)'
		);
	}
	if (mode === 'verify-ca' && ca === undefined) {
		throw new DatabaseConfigError('AAD_DB_PG_TLS_MODE: verify-ca requires AAD_DB_PG_TLS_CA_FILE');
	}
	if (mode === 'require' && ca !== undefined) {
		ctx.warnings.push('AAD_DB_PG_TLS_CA_FILE ignored: AAD_DB_PG_TLS_MODE require does not verify certificates');
		ca = undefined;
	}

	return {
		mode,
		ca,
		cert,
		key,
		serverName: envValue(env, 'AAD_DB_PG_TLS_SERVER_NAME') ?? fileString(file, 'server_name'),
		minVersion,
		maxVersion
	};
}

function resolveTlsVersion(
	ctx: Context,
	envKey: string,
	file: Record<string, unknown> | undefined,
	fileKey: string,
	fallback: TlsVersion
): TlsVersion {
	const fromEnv = envValue(ctx.env, envKey);
	const raw = fromEnv ?? fileString(file, fileKey);
	if (raw === undefined) {
		return fallback;
	}
	const version = TLS_VERSIONS[raw.toUpperCase()];
	if (!version) {
		const label = fromEnv !== undefined ? envKey : `storage.postgres.tls.${fileKey}`;
		throw new DatabaseConfigError(`${label}: "${raw}" is not one of ${Object.keys(TLS_VERSIONS).join(', ')}`);
	}
	return version;
}

async function readEnvFile(ctx: Context, key: string, path: string): Promise<string> {
	try {
		return await ctx.readFile(path);
	} catch (error) {
		throw new DatabaseConfigError(`${key}: cannot read "${path}" (${errorCode(error)})`);
	}
}

function parseInteger(value: unknown, label: string, min: number, max = Number.MAX_SAFE_INTEGER): number {
	const text = typeof value === 'string' ? value.trim() : String(value);
	const parsed = /^\d+$/.test(text) ? Number(text) : Number.NaN;
	if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
		const range = max === Number.MAX_SAFE_INTEGER ? `>= ${min}` : `${min}..${max}`;
		throw new DatabaseConfigError(`${label}: "${text}" is not an integer ${range}`);
	}
	return parsed;
}

function envValue(env: Env, key: string, trim = true): string | undefined {
	const raw = env[key];
	if (raw === undefined) {
		return undefined;
	}
	const value = trim ? raw.trim() : raw;
	return value === '' ? undefined : value;
}

function fileString(section: Record<string, unknown> | undefined, key: string): string | undefined {
	const value = section?.[key];
	if (value === undefined || value === null || value === '') {
		return undefined;
	}
	return String(value);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined;
}

function errorCode(error: unknown): string {
	return (error as NodeJS.ErrnoException).code ?? 'error';
}

function typeName(type: DatabaseConfig['type']): string {
	return type === 'sqlite' ? 'SQLITE' : 'PG';
}
