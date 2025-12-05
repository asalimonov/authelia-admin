import type {
	IDirectoryService,
	User,
	UserSummary,
	Group,
	GroupSummary,
	CreateUserInput,
	UpdateUserInput,
	CreateGroupInput,
	UpdateGroupInput,
	OperationResult,
	Schema
} from '../../types';
import type { LLDAPGraphQLConfig } from '../../config';
import { LLDAPGraphQLClient } from './client';
import * as queries from './queries';
import * as mutations from './mutations';
import * as mappers from './mappers';
import { Client as LdapClient, Attribute, Change } from 'ldapts';
import type {
	LLDAPUser,
	LLDAPUserSummary,
	LLDAPGroup,
	LLDAPGroupSummary,
	LLDAPAttributeSchema
} from './mappers';

interface UsersResponse {
	users: LLDAPUserSummary[];
}

interface UserResponse {
	user: LLDAPUser;
}

interface GroupsResponse {
	groups: LLDAPGroupSummary[];
}

interface GroupResponse {
	group: LLDAPGroup;
}

interface CreateUserResponse {
	createUser: LLDAPUser;
}

interface CreateGroupResponse {
	createGroup: {
		id: number;
		displayName: string;
		uuid: string;
		creationDate: string;
	};
}

interface UpdateResponse {
	updateUser?: { ok: boolean };
	updateGroup?: { ok: boolean };
}

interface DeleteResponse {
	deleteUser?: { ok: boolean };
	deleteGroup?: { ok: boolean };
}

interface MembershipResponse {
	addUserToGroup?: { ok: boolean };
	removeUserFromGroup?: { ok: boolean };
}

interface SchemaResponse {
	schema: {
		userSchema: {
			attributes: LLDAPAttributeSchema[];
		};
		groupSchema: {
			attributes: LLDAPAttributeSchema[];
		};
	};
}

interface ApiVersionResponse {
	apiVersion: string;
}

// Extended group summary that includes numeric id for internal use
interface LLDAPGroupWithNumericId extends LLDAPGroupSummary {
	id: number;
}

export class LLDAPGraphQLService implements IDirectoryService {
	private client: LLDAPGraphQLClient;
	private config: LLDAPGraphQLConfig;

	constructor(config: LLDAPGraphQLConfig) {
		this.client = new LLDAPGraphQLClient(config);
		this.config = config;
	}

	/**
	 * Get LDAP URL from config.
	 * Uses ldap_host and ldap_port from config, with fallback to derive from endpoint.
	 */
	private getLdapUrl(): string {
		const host = this.config.ldap_host || this.deriveHostFromEndpoint();
		const port = this.config.ldap_port || 3890;
		return `ldap://${host}:${port}`;
	}

	/**
	 * Derive LDAP host from GraphQL endpoint as fallback.
	 * GraphQL: http://lldap:17170/api/graphql -> host: lldap
	 */
	private deriveHostFromEndpoint(): string {
		try {
			const url = new URL(this.config.endpoint);
			return url.hostname;
		} catch {
			// Fallback for malformed URLs
			const match = this.config.endpoint.match(/\/\/([^:/]+)/);
			return match ? match[1] : 'lldap';
		}
	}

	/**
	 * Get the LDAP base DN from configuration.
	 * Throws an error if not configured, as there is no safe default.
	 */
	private getBaseDn(): string {
		const baseDn = this.config.ldap_base_dn;
		if (!baseDn) {
			throw new Error(
				'LDAP base DN is not configured. ' +
				'Set ldap_base_dn in config.yml or AAD_DIRECTORY_LLDAP_GRAPHQL_LDAP_BASE_DN environment variable.'
			);
		}
		return baseDn;
	}

	/**
	 * Create an LDAP connection for password changes.
	 * LLDAP's GraphQL doesn't support password changes, so we use LDAP.
	 */
	private async createLdapConnection(): Promise<LdapClient> {
		const ldapUrl = this.getLdapUrl();
		const baseDn = this.getBaseDn();

		const ldapClient = new LdapClient({ url: ldapUrl });

		// Bind as the admin user
		// LLDAP uses uid=username,ou=people,dc=... format for user DN
		const bindDn = `uid=${this.config.user},ou=people,${baseDn}`;
		await ldapClient.bind(bindDn, this.config.password);

		return ldapClient;
	}

	/**
	 * Helper to find numeric group ID from uuid.
	 * LLDAP uses numeric IDs internally but we expose uuid as the common id.
	 */
	private async findNumericGroupId(uuid: string): Promise<number | null> {
		const result = await this.client.query<GroupsResponse>(queries.LIST_GROUPS);
		const group = result.groups.find((g: LLDAPGroupWithNumericId) => g.uuid === uuid);
		return group ? group.id : null;
	}

	// === User operations ===

	async createUser(input: CreateUserInput): Promise<User> {
		const result = await this.client.mutation<CreateUserResponse>(mutations.CREATE_USER, {
			user: mappers.toCreateUserInput(input)
		});
		return mappers.mapUser(result.createUser);
	}

	async updateUser(input: UpdateUserInput): Promise<OperationResult> {
		try {
			const result = await this.client.mutation<UpdateResponse>(mutations.UPDATE_USER, {
				user: mappers.toUpdateUserInput(input)
			});
			return { success: result.updateUser?.ok ?? false };
		} catch (error) {
			return { success: false, error: (error as Error).message };
		}
	}

	async deleteUser(userId: string): Promise<OperationResult> {
		try {
			const result = await this.client.mutation<DeleteResponse>(mutations.DELETE_USER, {
				userId
			});
			return { success: result.deleteUser?.ok ?? false };
		} catch (error) {
			return { success: false, error: (error as Error).message };
		}
	}

	async listUsers(): Promise<UserSummary[]> {
		const result = await this.client.query<UsersResponse>(queries.LIST_USERS);
		return result.users.map(mappers.mapUserSummary);
	}

	async getUserDetails(userId: string): Promise<User | null> {
		try {
			const result = await this.client.query<UserResponse>(queries.GET_USER, { userId });
			return mappers.mapUser(result.user);
		} catch {
			return null;
		}
	}

	async getUserByEmail(email: string): Promise<User | null> {
		try {
			const users = await this.listUsers();
			const normalizedEmail = email.toLowerCase();
			const matchingUser = users.find((u) => u.email.toLowerCase() === normalizedEmail);
			if (matchingUser) {
				return this.getUserDetails(matchingUser.id);
			}
			return null;
		} catch {
			return null;
		}
	}

	async changePassword(userId: string, newPassword: string): Promise<OperationResult> {
		let ldapClient: LdapClient | null = null;
		try {
			// LLDAP's GraphQL API doesn't support password changes,
			// so we use LDAP protocol directly
			ldapClient = await this.createLdapConnection();
			const baseDn = this.getBaseDn();

			// LLDAP uses uid=username,ou=people,dc=... format
			const userDn = `uid=${userId},ou=people,${baseDn}`;

			const change = new Change({
				operation: 'replace',
				modification: new Attribute({
					type: 'userPassword',
					values: [newPassword]
				})
			});

			await ldapClient.modify(userDn, change);
			return { success: true };
		} catch (error) {
			return { success: false, error: (error as Error).message };
		} finally {
			if (ldapClient) {
				try {
					await ldapClient.unbind();
				} catch {
					// Ignore unbind errors
				}
			}
		}
	}

	// === Group operations ===

	async createGroup(input: CreateGroupInput): Promise<Group> {
		const result = await this.client.mutation<CreateGroupResponse>(mutations.CREATE_GROUP, {
			name: mappers.toCreateGroupName(input)
		});

		// The createGroup mutation returns minimal data, so we construct a Group
		// Use uuid as the common id
		return {
			id: result.createGroup.uuid,
			displayName: result.createGroup.displayName,
			creationDate: new Date(result.createGroup.creationDate),
			members: [],
			attributes: []
		};
	}

	async updateGroup(input: UpdateGroupInput): Promise<OperationResult> {
		try {
			// Resolve uuid to numeric id
			const numericId = await this.findNumericGroupId(input.id);
			if (numericId === null) {
				return { success: false, error: `Group with id ${input.id} not found` };
			}

			const result = await this.client.mutation<UpdateResponse>(mutations.UPDATE_GROUP, {
				group: mappers.toUpdateGroupInput(input, numericId)
			});
			return { success: result.updateGroup?.ok ?? false };
		} catch (error) {
			return { success: false, error: (error as Error).message };
		}
	}

	async deleteGroup(groupId: string): Promise<OperationResult> {
		try {
			// Resolve uuid to numeric id
			const numericId = await this.findNumericGroupId(groupId);
			if (numericId === null) {
				return { success: false, error: `Group with id ${groupId} not found` };
			}

			const result = await this.client.mutation<DeleteResponse>(mutations.DELETE_GROUP, {
				groupId: numericId
			});
			return { success: result.deleteGroup?.ok ?? false };
		} catch (error) {
			return { success: false, error: (error as Error).message };
		}
	}

	async listGroups(): Promise<GroupSummary[]> {
		const result = await this.client.query<GroupsResponse>(queries.LIST_GROUPS);
		return result.groups.map(mappers.mapGroupSummary);
	}

	async getGroupDetails(groupId: string): Promise<Group | null> {
		try {
			// Resolve uuid to numeric id
			const numericId = await this.findNumericGroupId(groupId);
			if (numericId === null) {
				return null;
			}

			const result = await this.client.query<GroupResponse>(queries.GET_GROUP, {
				groupId: numericId
			});
			return mappers.mapGroup(result.group);
		} catch {
			return null;
		}
	}

	// === Membership operations ===

	async addUserToGroup(userId: string, groupId: string): Promise<OperationResult> {
		try {
			// Resolve uuid to numeric id
			const numericId = await this.findNumericGroupId(groupId);
			if (numericId === null) {
				return { success: false, error: `Group with id ${groupId} not found` };
			}

			const result = await this.client.mutation<MembershipResponse>(mutations.ADD_USER_TO_GROUP, {
				userId,
				groupId: numericId
			});
			return { success: result.addUserToGroup?.ok ?? false };
		} catch (error) {
			return { success: false, error: (error as Error).message };
		}
	}

	async removeUserFromGroup(userId: string, groupId: string): Promise<OperationResult> {
		try {
			// Resolve uuid to numeric id
			const numericId = await this.findNumericGroupId(groupId);
			if (numericId === null) {
				return { success: false, error: `Group with id ${groupId} not found` };
			}

			const result = await this.client.mutation<MembershipResponse>(
				mutations.REMOVE_USER_FROM_GROUP,
				{
					userId,
					groupId: numericId
				}
			);
			return { success: result.removeUserFromGroup?.ok ?? false };
		} catch (error) {
			return { success: false, error: (error as Error).message };
		}
	}

	// === Schema operations ===

	async getUserAttributesSchema(): Promise<Schema> {
		const result = await this.client.query<SchemaResponse>(queries.GET_SCHEMA);
		return {
			attributes: result.schema.userSchema.attributes.map(mappers.mapAttributeSchema)
		};
	}

	async getGroupAttributesSchema(): Promise<Schema> {
		const result = await this.client.query<SchemaResponse>(queries.GET_SCHEMA);
		return {
			attributes: result.schema.groupSchema.attributes.map(mappers.mapAttributeSchema)
		};
	}

	// === Connection test ===

	async testConnection(): Promise<OperationResult> {
		try {
			await this.client.query<ApiVersionResponse>(queries.GET_API_VERSION);
			return { success: true };
		} catch (error) {
			return { success: false, error: (error as Error).message };
		}
	}
}

// Re-export for convenience
export { LLDAPGraphQLClient } from './client';
