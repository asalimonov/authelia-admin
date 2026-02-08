import { promises as fs } from 'node:fs';
import { parse } from 'yaml';
import sqlite3 from 'sqlite3';
import { promisify } from 'node:util';
import { createLogger } from './logger';

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

export interface DatabaseConfig {
    type: 'sqlite' | 'postgres';
    path?: string;
    connectionString?: string;
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
            log.debug('Using PostgreSQL database');
            return {
                type: 'postgres',
                connectionString: config.storage.postgres.host
            };
        }

        return null;
    } catch (error) {
        log.error('Error reading database configuration:', error);
        return null;
    }
}

export async function createDatabaseAdapter(config: DatabaseConfig): Promise<DatabaseAdapter> {
    switch (config.type) {
        case 'sqlite':
            if (!config.path) {
                log.error('SQLite database path is required')
                throw new Error('SQLite database path is required');
            }
            return await SQLiteAdapter.create(config.path);
        case 'postgres':
            if (!config.connectionString) {
                log.error('PostgreSQL connection string is required')
                throw new Error('PostgreSQL connection string is required');
            }
            return new PostgreSQLAdapter(config.connectionString);
        default:
            log.error('Unsupported database type:', config.type)
            throw new Error(`Unsupported database type: ${config.type}`);
    }
}