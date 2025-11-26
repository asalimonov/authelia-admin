import { promises as fs } from 'node:fs';
import { parse } from 'yaml';
import { Client, Attribute, Change } from 'ldapts';
import { escapeFilter, escapeDn, validateAttributeName } from '$lib/utils/ldap';

export interface LDAPConfig {
    implementation: string;
    address: string;
    base_dn: string;
    additional_users_dn: string;
    users_filter: string;
    additional_groups_dn: string;
    groups_filter: string;
    bind_user: string;
    bind_password: string;
    attributes: {
        username: string;
        display_name: string;
        mail: string;
        member_of: string;
        group_name: string;
    };
}

export interface LDAPUser {
    uid: string;
    displayName: string;
    mail: string;
    givenName?: string;
    sn?: string;
    entryUUID: string;
    createTimestamp?: string;
    memberOf?: string[];
}

export interface LDAPGroup {
    cn: string;
    member?: string[];
    description?: string;
    entryUUID: string;
    createTimestamp?: string;
}

export class LdapClient {
    private static instance: LdapClient | null = null;
    private config: LDAPConfig | null = null;

    private constructor() {}

    public static getInstance(): LdapClient {
        if (!LdapClient.instance) {
            LdapClient.instance = new LdapClient();
        }
        return LdapClient.instance;
    }

    private async loadConfig(): Promise<LDAPConfig> {
        if (this.config) {
            return this.config;
        }
        
        try {
            // Allow configuration path to be set via environment variable
            const configPath = process.env.AUTHELIA_CONFIG_PATH || '/config/configuration.yml';
            const configContent = await fs.readFile(configPath, 'utf-8');
            const config = parse(configContent);
            
            if (!config?.authentication_backend?.ldap) {
                throw new Error('LDAP configuration not found in Authelia config');
            }
            
            const ldapConfig = config.authentication_backend.ldap;
            
            this.config = {
                implementation: ldapConfig.implementation,
                address: ldapConfig.address,
                base_dn: ldapConfig.base_dn,
                additional_users_dn: ldapConfig.additional_users_dn,
                users_filter: ldapConfig.users_filter,
                additional_groups_dn: ldapConfig.additional_groups_dn,
                groups_filter: ldapConfig.groups_filter,
                bind_user: ldapConfig.user,
                bind_password: ldapConfig.password,
                attributes: ldapConfig.attributes
            };
            
            return this.config;
        } catch (error) {
            console.error('Error reading LDAP configuration:', error);
            throw new Error(`Failed to load LDAP configuration: ${(error as Error).message}`);
        }
    }

    private async createConnection(): Promise<{ client: Client; config: LDAPConfig }> {
        const config = await this.loadConfig();
        const client = new Client({ url: config.address });
        
        try {
            await client.bind(config.bind_user, config.bind_password);
            return { client, config };
        } catch (error) {
            console.error('Error binding to LDAP server:', error);
            await client.unbind();
            throw new Error(`Failed to connect to LDAP server: ${(error as Error).message}`);
        }
    }

    public async getServerInfo(): Promise<string | null> {
        try {
            const config = await this.loadConfig();
            return config.address;
        } catch {
            return null;
        }
    }

    public async getUsers(): Promise<LDAPUser[]> {
        const { client, config } = await this.createConnection();
        
        try {
            const searchBase = `${config.additional_users_dn},${config.base_dn}`;
            
            const { searchEntries } = await client.search(searchBase, {
                scope: 'sub',
                filter: '(objectClass=person)',
                attributes: [
                    config.attributes.username,
                    config.attributes.display_name,
                    config.attributes.mail,
                    'givenName',
                    'sn',
                    'entryUUID',
                    'createTimestamp',
                    config.attributes.member_of
                ]
            });
            
            const users: LDAPUser[] = searchEntries.map((entry: any) => ({
                uid: entry[config.attributes.username] || '',
                displayName: entry[config.attributes.display_name] || '',
                mail: entry[config.attributes.mail] || '',
                givenName: entry.givenName || undefined,
                sn: entry.sn || undefined,
                entryUUID: entry.entryUUID || '',
                createTimestamp: entry.createTimestamp || undefined,
                memberOf: Array.isArray(entry[config.attributes.member_of])
                    ? entry[config.attributes.member_of]
                    : entry[config.attributes.member_of]
                        ? [entry[config.attributes.member_of]]
                        : []
            }));
            
            return users;
        } finally {
            await client.unbind();
        }
    }

    public async getUser(uid: string): Promise<LDAPUser | null> {
        const { client, config } = await this.createConnection();
        
        try {
            const searchBase = `${config.additional_users_dn},${config.base_dn}`;
            const escapedUid = escapeFilter(uid);
            const validatedAttribute = validateAttributeName(config.attributes.username);
            
            const { searchEntries } = await client.search(searchBase, {
                scope: 'sub',
                filter: `(&(objectClass=person)(${validatedAttribute}=${escapedUid}))`,
                attributes: [
                    config.attributes.username,
                    config.attributes.display_name,
                    config.attributes.mail,
                    'givenName',
                    'sn',
                    'entryUUID',
                    'createTimestamp',
                    config.attributes.member_of
                ]
            });
            
            if (searchEntries.length === 0) {
                return null;
            }
            
            const entry = searchEntries[0];
            return {
                uid: entry[config.attributes.username] || '',
                displayName: entry[config.attributes.display_name] || '',
                mail: entry[config.attributes.mail] || '',
                givenName: entry.givenName || undefined,
                sn: entry.sn || undefined,
                entryUUID: entry.entryUUID || '',
                createTimestamp: entry.createTimestamp || undefined,
                memberOf: Array.isArray(entry[config.attributes.member_of])
                    ? entry[config.attributes.member_of]
                    : entry[config.attributes.member_of]
                        ? [entry[config.attributes.member_of]]
                        : []
            };
        } finally {
            await client.unbind();
        }
    }

    public async updateUser(
        uid: string,
        updates: {
            displayName?: string;
            mail?: string;
            givenName?: string;
            sn?: string;
        }
    ): Promise<boolean> {
        const { client, config } = await this.createConnection();
        
        try {
            const escapedUid = escapeDn(uid);
            const validatedAttribute = validateAttributeName(config.attributes.username);
            const userDn = `${validatedAttribute}=${escapedUid},${config.additional_users_dn},${config.base_dn}`;
            
            const changes: Change[] = [];
            
            if (updates.displayName !== undefined) {
                changes.push(new Change({
                    operation: 'replace',
                    modification: new Attribute({
                        type: config.attributes.display_name,
                        values: [updates.displayName]
                    })
                }));
            }
            
            if (updates.mail !== undefined) {
                changes.push(new Change({
                    operation: 'replace',
                    modification: new Attribute({
                        type: config.attributes.mail,
                        values: [updates.mail]
                    })
                }));
            }
            
            if (updates.givenName !== undefined) {
                changes.push(new Change({
                    operation: 'replace',
                    modification: new Attribute({
                        type: 'givenName',
                        values: [updates.givenName]
                    })
                }));
            }
            
            if (updates.sn !== undefined) {
                changes.push(new Change({
                    operation: 'replace',
                    modification: new Attribute({
                        type: 'sn',
                        values: [updates.sn]
                    })
                }));
            }
            
            if (changes.length > 0) {
                await client.modify(userDn, changes);
            }
            
            return true;
        } catch (error) {
            console.error('Error updating LDAP user:', error);
            return false;
        } finally {
            await client.unbind();
        }
    }

    public async changePassword(uid: string, newPassword: string): Promise<boolean> {
        const { client, config } = await this.createConnection();
        
        try {
            const escapedUid = escapeDn(uid);
            const validatedAttribute = validateAttributeName(config.attributes.username);
            const userDn = `${validatedAttribute}=${escapedUid},${config.additional_users_dn},${config.base_dn}`;
            
            const change = new Change({
                operation: 'replace',
                modification: new Attribute({
                    type: 'userPassword',
                    values: [newPassword]
                })
            });
            
            await client.modify(userDn, change);
            
            return true;
        } catch (error) {
            console.error('Error changing LDAP password:', error);
            return false;
        } finally {
            await client.unbind();
        }
    }

    public async getGroups(): Promise<LDAPGroup[]> {
        const { client, config } = await this.createConnection();
        
        try {
            const searchBase = `${config.additional_groups_dn},${config.base_dn}`;
            
            const { searchEntries } = await client.search(searchBase, {
                scope: 'sub',
                filter: '(objectClass=groupOfNames)',
                attributes: [
                    config.attributes.group_name,
                    'member',
                    'description',
                    'entryUUID',
                    'createTimestamp'
                ]
            });
            
            const groups: LDAPGroup[] = searchEntries.map((entry: any) => ({
                cn: entry[config.attributes.group_name] || '',
                member: Array.isArray(entry.member)
                    ? entry.member
                    : entry.member
                        ? [entry.member]
                        : [],
                description: entry.description || undefined,
                entryUUID: entry.entryUUID || '',
                createTimestamp: entry.createTimestamp || undefined
            }));
            
            return groups;
        } finally {
            await client.unbind();
        }
    }
}


export const ldapClient = LdapClient.getInstance();