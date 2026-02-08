import { promises as fs } from 'node:fs';
import { parse } from 'yaml';
import sqlite3 from 'sqlite3';
import pg from 'pg';
import { promisify } from 'node:util';
import { createLogger } from './logger';

// Override pg type parsers to return ISO strings for timestamps (matching SQLite behavior)
// OID 1114 = TIMESTAMP, OID 1184 = TIMESTAMPTZ
pg.types.setTypeParser(1114, (val: string) => val);
pg.types.setTypeParser(1184, (val: string) => val);
// OID 20 = INT8/BIGINT — pg returns these as strings by default; parse to number
pg.types.setTypeParser(20, (val: string) => parseInt(val, 10));

const log = createLogger('database');

export interface TOTPConfiguration {
    id: number;
    created_at: string;
    last_used_at: string | null;
    username: string;
    issuer: string | null;
    algorithm: string;
    digits: number;
    period: number;
    secret: Buffer;
}

export interface TOTPHistory {
    id: number;
    created_at: string;
    username: string;
    step: string;
}

export interface BannedUser {
    id: number;
    time: string;
    expires: string | null;
    expired: string | null;
    revoked: string | null;
    username: string;
    source: string;
    reason: string | null;
}

export interface BannedIP {
    id: number;
    time: string;
    expires: string | null;
    expired: string | null;
    revoked: string | null;
    ip: string;
    source: string;
    reason: string | null;
}

export interface PostgresConfig {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    schema?: string;
}

export interface DatabaseConfig {
    type: 'sqlite' | 'postgres';
    path?: string;
    postgres?: PostgresConfig;
}

export interface DatabaseAdapter {
    getTOTPConfigurations(): Promise<TOTPConfiguration[]>;
    deleteTOTPConfiguration(id: number): Promise<boolean>;
    getTOTPHistory(limit?: number): Promise<TOTPHistory[]>;
    getBannedUsers(): Promise<BannedUser[]>;
    createBannedUser(username: string, expires: Date | null, source: string, reason: string | null): Promise<boolean>;
    deleteBannedUser(id: number): Promise<boolean>;
    getBannedIPs(): Promise<BannedIP[]>;
    createBannedIP(ip: string, expires: Date | null, source: string, reason: string | null): Promise<boolean>;
    deleteBannedIP(id: number): Promise<boolean>;
    healthCheck(): Promise<void>;
    close(): Promise<void>;
}

class SQLiteAdapter implements DatabaseAdapter {
    private db: sqlite3.Database;
    private dbAll: (sql: string, params?: unknown[]) => Promise<unknown[]>;
    private dbClose: () => Promise<void>;

    private constructor(db: sqlite3.Database) {
        this.db = db;
        // Configure SQLite for better concurrency with Authelia
        this.db.configure('busyTimeout', 5000); // Wait up to 5 seconds if database is locked
        
        this.dbAll = promisify(this.db.all.bind(this.db));
        this.dbClose = promisify(this.db.close.bind(this.db));
    }

    static async create(dbPath: string): Promise<SQLiteAdapter> {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
                if (err) {
                    log.error('Error opening database:', err);
                    reject(err);
                } else {
                    log.debug(`Database opened: ${dbPath}`);
                    resolve(new SQLiteAdapter(db));
                }
            });
        });
    }
    
    // Custom dbRun that returns the statement info with changes
    private dbRun(sql: string, params?: unknown[]): Promise<{ changes: number; lastID: number }> {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ changes: this.changes, lastID: this.lastID });
                }
            });
        });
    }

    async getTOTPConfigurations(): Promise<TOTPConfiguration[]> {
        const query = `
            SELECT 
                id,
                created_at,
                last_used_at,
                username,
                issuer,
                algorithm,
                digits,
                period,
                secret
            FROM totp_configurations
            ORDER BY username ASC
        `;
        
        try {
            const rows = await this.dbAll(query);
            return rows.map(row => ({
                ...row,
                secret: Buffer.from('[ENCRYPTED]')
            })) as TOTPConfiguration[];
        } catch (error) {
            log.error('Error reading TOTP configurations:', error);
            throw error;
        }
    }

    async deleteTOTPConfiguration(id: number): Promise<boolean> {
        const query = `DELETE FROM totp_configurations WHERE id = ?`;

        try {
            const result = await this.dbRun(query, [id]);
            // Check the changes property to see if any rows were deleted
            return result && result.changes > 0;
        } catch (error) {
            log.error('Error deleting TOTP configuration:', error);
            throw error;
        }
    }

    async getTOTPHistory(limit = 100): Promise<TOTPHistory[]> {
        const query = `
            SELECT 
                id,
                created_at,
                username,
                step
            FROM totp_history
            ORDER BY created_at DESC
            LIMIT ?
        `;
        
        try {
            const rows = await this.dbAll(query, [limit]);
            return rows as TOTPHistory[];
        } catch (error) {
            log.error('Error reading TOTP history:', error);
            throw error;
        }
    }

    async getBannedUsers(): Promise<BannedUser[]> {
        const query = `
            SELECT 
                id,
                time,
                expires,
                expired,
                revoked,
                username,
                source,
                reason
            FROM banned_user
            ORDER BY time DESC
        `;
        
        try {
            const rows = await this.dbAll(query);
            return rows as BannedUser[];
        } catch (error) {
            log.error('Error reading banned users:', error);
            throw error;
        }
    }

    async createBannedUser(username: string, expires: Date | null, source: string, reason: string | null): Promise<boolean> {
        const query = `
            INSERT INTO banned_user (username, expires, source, reason)
            VALUES (?, ?, ?, ?)
        `;
        
        try {
            const expiresStr = expires ? expires.toISOString().replace('T', ' ').replace('Z', '') : null;
            await this.dbRun(query, [username, expiresStr, source, reason]);
            return true;
        } catch (error) {
            log.error('Error creating banned user:', error);
            throw error;
        }
    }

    async deleteBannedUser(id: number): Promise<boolean> {
        const query = `DELETE FROM banned_user WHERE id = ?`;

        try {
            const result = await this.dbRun(query, [id]);
            // Check the changes property to see if any rows were deleted
            return result && result.changes > 0;
        } catch (error) {
            log.error('Error deleting banned user:', error);
            throw error;
        }
    }

    async getBannedIPs(): Promise<BannedIP[]> {
        const query = `
            SELECT 
                id,
                time,
                expires,
                expired,
                revoked,
                ip,
                source,
                reason
            FROM banned_ip
            ORDER BY time DESC
        `;
        
        try {
            const rows = await this.dbAll(query);
            return rows as BannedIP[];
        } catch (error) {
            log.error('Error reading banned IPs:', error);
            throw error;
        }
    }

    async createBannedIP(ip: string, expires: Date | null, source: string, reason: string | null): Promise<boolean> {
        const query = `
            INSERT INTO banned_ip (ip, expires, source, reason)
            VALUES (?, ?, ?, ?)
        `;

        try {
            const expiresStr = expires ? expires.toISOString().replace('T', ' ').replace('Z', '') : null;
            await this.dbRun(query, [ip, expiresStr, source, reason]);
            return true;
        } catch (error) {
            log.error('Error creating banned IP:', error);
            throw error;
        }
    }

    async deleteBannedIP(id: number): Promise<boolean> {
        const query = `DELETE FROM banned_ip WHERE id = ?`;

        try {
            const result = await this.dbRun(query, [id]);
            // Check the changes property to see if any rows were deleted
            return result && result.changes > 0;
        } catch (error) {
            log.error('Error deleting banned IP:', error);
            throw error;
        }
    }

    async healthCheck(): Promise<void> {
        const query = `SELECT 1`;

        try {
            await this.dbAll(query);
        } catch (error) {
            log.error('Database health check failed:', error);
            throw error;
        }
    }

    async close(): Promise<void> {
        await this.dbClose();
    }
}

class PostgreSQLAdapter implements DatabaseAdapter {
    private pool: pg.Pool;

    private constructor(pool: pg.Pool) {
        this.pool = pool;
    }

    static async create(config: PostgresConfig): Promise<PostgreSQLAdapter> {
        const poolConfig: pg.PoolConfig = {
            host: config.host,
            port: config.port,
            database: config.database,
            user: config.username,
            password: config.password,
        };

        if (config.schema && config.schema !== 'public') {
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(config.schema)) {
                throw new Error(`Invalid PostgreSQL schema name: ${config.schema}`);
            }
            poolConfig.options = `-c search_path=${config.schema}`;
        }

        const pool = new pg.Pool(poolConfig);

        // Prevent unhandled errors on idle clients from crashing the process
        pool.on('error', (err) => {
            log.error('Unexpected error on idle PostgreSQL client:', err);
        });

        // Verify connection
        try {
            const client = await pool.connect();
            client.release();
        } catch (error) {
            await pool.end();
            throw error;
        }

        log.debug(`PostgreSQL pool created: ${config.host}:${config.port}/${config.database}`);
        return new PostgreSQLAdapter(pool);
    }

    async getTOTPConfigurations(): Promise<TOTPConfiguration[]> {
        const query = `
            SELECT
                id,
                created_at,
                last_used_at,
                username,
                issuer,
                algorithm,
                digits,
                period,
                secret
            FROM totp_configurations
            ORDER BY username ASC
        `;

        try {
            const result = await this.pool.query(query);
            return result.rows.map((row: TOTPConfiguration) => ({
                ...row,
                secret: Buffer.from('[ENCRYPTED]')
            }));
        } catch (error) {
            log.error('Error reading TOTP configurations:', error);
            throw error;
        }
    }

    async deleteTOTPConfiguration(id: number): Promise<boolean> {
        const query = `DELETE FROM totp_configurations WHERE id = $1`;

        try {
            const result = await this.pool.query(query, [id]);
            return (result.rowCount ?? 0) > 0;
        } catch (error) {
            log.error('Error deleting TOTP configuration:', error);
            throw error;
        }
    }

    async getTOTPHistory(limit = 100): Promise<TOTPHistory[]> {
        const query = `
            SELECT
                id,
                created_at,
                username,
                step
            FROM totp_history
            ORDER BY created_at DESC
            LIMIT $1
        `;

        try {
            const result = await this.pool.query(query, [limit]);
            return result.rows as TOTPHistory[];
        } catch (error) {
            log.error('Error reading TOTP history:', error);
            throw error;
        }
    }

    async getBannedUsers(): Promise<BannedUser[]> {
        const query = `
            SELECT
                id,
                time,
                expires,
                expired,
                revoked,
                username,
                source,
                reason
            FROM banned_user
            ORDER BY time DESC
        `;

        try {
            const result = await this.pool.query(query);
            return result.rows as BannedUser[];
        } catch (error) {
            log.error('Error reading banned users:', error);
            throw error;
        }
    }

    async createBannedUser(username: string, expires: Date | null, source: string, reason: string | null): Promise<boolean> {
        const query = `
            INSERT INTO banned_user (username, expires, source, reason)
            VALUES ($1, $2, $3, $4)
        `;

        try {
            await this.pool.query(query, [username, expires, source, reason]);
            return true;
        } catch (error) {
            log.error('Error creating banned user:', error);
            throw error;
        }
    }

    async deleteBannedUser(id: number): Promise<boolean> {
        const query = `DELETE FROM banned_user WHERE id = $1`;

        try {
            const result = await this.pool.query(query, [id]);
            return (result.rowCount ?? 0) > 0;
        } catch (error) {
            log.error('Error deleting banned user:', error);
            throw error;
        }
    }

    async getBannedIPs(): Promise<BannedIP[]> {
        const query = `
            SELECT
                id,
                time,
                expires,
                expired,
                revoked,
                ip,
                source,
                reason
            FROM banned_ip
            ORDER BY time DESC
        `;

        try {
            const result = await this.pool.query(query);
            return result.rows as BannedIP[];
        } catch (error) {
            log.error('Error reading banned IPs:', error);
            throw error;
        }
    }

    async createBannedIP(ip: string, expires: Date | null, source: string, reason: string | null): Promise<boolean> {
        const query = `
            INSERT INTO banned_ip (ip, expires, source, reason)
            VALUES ($1, $2, $3, $4)
        `;

        try {
            await this.pool.query(query, [ip, expires, source, reason]);
            return true;
        } catch (error) {
            log.error('Error creating banned IP:', error);
            throw error;
        }
    }

    async deleteBannedIP(id: number): Promise<boolean> {
        const query = `DELETE FROM banned_ip WHERE id = $1`;

        try {
            const result = await this.pool.query(query, [id]);
            return (result.rowCount ?? 0) > 0;
        } catch (error) {
            log.error('Error deleting banned IP:', error);
            throw error;
        }
    }

    async healthCheck(): Promise<void> {
        try {
            await this.pool.query('SELECT 1');
        } catch (error) {
            log.error('Database health check failed:', error);
            throw error;
        }
    }

    async close(): Promise<void> {
        // No-op: pool is long-lived and shared across requests.
        // Pool cleanup happens on process exit via shutdownPool().
    }

    async shutdownPool(): Promise<void> {
        await this.pool.end();
    }
}


export function getDatabaseDisplayInfo(config: DatabaseConfig): string | null {
    if (config.type === 'sqlite') return config.path ?? null;
    if (config.type === 'postgres' && config.postgres) {
        return `PostgreSQL: ${config.postgres.host}:${config.postgres.port}/${config.postgres.database}`;
    }
    return null;
}

export async function getDatabaseConfig(): Promise<DatabaseConfig | null> {
    try {
        const configPath = process.env.AUTHELIA_CONFIG_PATH || '/config/configuration.yml';
        const configContent = await fs.readFile(configPath, 'utf-8');
        const config = parse(configContent);

        if (!config?.storage) {
            return null;
        }

        if (config.storage.local?.path) {
            log.debug(`Using SQLite database: ${config.storage.local.path}`);
            return {
                type: 'sqlite',
                path: config.storage.local.path
            };
        }

        if (config.storage.postgres) {
            const pgStorage = config.storage.postgres;
            let host = 'localhost';
            let port = 5432;

            if (pgStorage.address) {
                // Authelia uses 'tcp://host:port' format - replace tcp:// with http:// for URL parsing
                const url = new URL(pgStorage.address.replace(/^tcp:\/\//, 'http://'));
                host = url.hostname;
                port = url.port ? parseInt(url.port, 10) : 5432;
            } else if (pgStorage.host) {
                // Legacy Authelia config with plain host field
                host = pgStorage.host;
                port = pgStorage.port ? parseInt(String(pgStorage.port), 10) : 5432;
            }

            const database = pgStorage.database || 'authelia';
            const username = pgStorage.username || 'authelia';
            const password = pgStorage.password || '';
            const schema = pgStorage.schema || 'public';

            log.debug(`Using PostgreSQL database: ${host}:${port}/${database}`);
            return {
                type: 'postgres',
                postgres: { host, port, database, username, password, schema }
            };
        }

        return null;
    } catch (error) {
        log.error('Error reading database configuration:', error);
        return null;
    }
}

// Singleton PostgreSQL adapter - pool is shared across requests
let pgAdapterPromise: Promise<PostgreSQLAdapter> | null = null;

export async function createDatabaseAdapter(config: DatabaseConfig): Promise<DatabaseAdapter> {
    switch (config.type) {
        case 'sqlite':
            if (!config.path) {
                log.error('SQLite database path is required')
                throw new Error('SQLite database path is required');
            }
            return await SQLiteAdapter.create(config.path);
        case 'postgres':
            if (!config.postgres) {
                log.error('PostgreSQL configuration is required')
                throw new Error('PostgreSQL configuration is required');
            }
            if (!pgAdapterPromise) {
                pgAdapterPromise = PostgreSQLAdapter.create(config.postgres).catch((err) => {
                    pgAdapterPromise = null;
                    throw err;
                });
            }
            return await pgAdapterPromise;
        default:
            log.error('Unsupported database type:', config.type)
            throw new Error(`Unsupported database type: ${config.type}`);
    }
}

export async function shutdownDatabase(): Promise<void> {
    if (pgAdapterPromise) {
        try {
            const adapter = await pgAdapterPromise;
            await adapter.shutdownPool();
        } catch {
            // Pool creation may have failed; nothing to shut down
        }
        pgAdapterPromise = null;
    }
}

// Graceful shutdown: drain PostgreSQL pool on process exit
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, async () => {
        try {
            await Promise.race([
                shutdownDatabase(),
                new Promise(resolve => setTimeout(resolve, 5000))
            ]);
        } catch { /* ignore shutdown errors */ }
        process.exit(0);
    });
}
