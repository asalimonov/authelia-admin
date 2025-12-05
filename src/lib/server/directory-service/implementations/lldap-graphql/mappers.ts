import type {
	User,
	UserSummary,
	UserWithGroups,
	Group,
	GroupSummary,
	AttributeValue,
	AttributeSchema,
	AttributeType,
	CreateUserInput,
	UpdateUserInput,
	CreateGroupInput,
	UpdateGroupInput
} from '../../types';

// === Raw LLDAP GraphQL response types ===

export interface LLDAPAttributeValue {
	name: string;
	value: string[];
}

export interface LLDAPGroupSummary {
	id: number;
	displayName: string;
	uuid: string;
}

export interface LLDAPUserSummary {
	id: string;
	email: string;
	displayName: string;
}

export interface LLDAPUserWithGroups extends LLDAPUserSummary {
	groups: LLDAPGroupSummary[];
}

export interface LLDAPUser {
	id: string;
	email: string;
	displayName: string;
	uuid: string;
	creationDate: string;
	groups: LLDAPGroupSummary[];
	attributes: LLDAPAttributeValue[];
}

export interface LLDAPGroup {
	id: number;
	displayName: string;
	uuid: string;
	creationDate: string;
	users: LLDAPUserSummary[];
	attributes: LLDAPAttributeValue[];
}

export interface LLDAPAttributeSchema {
	name: string;
	attributeType: string;
	isList: boolean;
	isVisible: boolean;
	isEditable: boolean;
	isReadonly: boolean;
}

// === Mappers from LLDAP to common types ===

export function mapUser(lldapUser: LLDAPUser): User {
	return {
		id: lldapUser.id,
		email: lldapUser.email,
		displayName: lldapUser.displayName,
		uuid: lldapUser.uuid,
		creationDate: new Date(lldapUser.creationDate),
		groups: lldapUser.groups.map(mapGroupSummary),
		attributes: lldapUser.attributes.map(mapAttributeValue)
	};
}

export function mapUserSummary(lldapUser: LLDAPUserSummary): UserSummary {
	return {
		id: lldapUser.id,
		email: lldapUser.email,
		displayName: lldapUser.displayName
	};
}

export function mapUserWithGroups(lldapUser: LLDAPUserWithGroups): UserWithGroups {
	return {
		id: lldapUser.id,
		email: lldapUser.email,
		displayName: lldapUser.displayName,
		groups: lldapUser.groups.map(mapGroupSummary)
	};
}

export function mapGroup(lldapGroup: LLDAPGroup): Group {
	return {
		id: lldapGroup.uuid, // Use uuid as the common id
		displayName: lldapGroup.displayName,
		creationDate: new Date(lldapGroup.creationDate),
		members: lldapGroup.users.map(mapUserSummary),
		attributes: lldapGroup.attributes.map(mapAttributeValue)
	};
}

export function mapGroupSummary(lldapGroup: LLDAPGroupSummary): GroupSummary {
	return {
		id: lldapGroup.uuid, // Use uuid as the common id
		displayName: lldapGroup.displayName
	};
}

export function mapAttributeValue(attr: LLDAPAttributeValue): AttributeValue {
	return {
		name: attr.name,
		values: attr.value
	};
}

export function mapAttributeSchema(schema: LLDAPAttributeSchema): AttributeSchema {
	return {
		name: schema.name,
		type: schema.attributeType as AttributeType,
		isList: schema.isList,
		isVisible: schema.isVisible,
		isEditable: schema.isEditable,
		isReadonly: schema.isReadonly
	};
}

// === Reverse mappers for inputs (common types to LLDAP GraphQL input) ===

export interface LLDAPCreateUserInput {
	id: string;
	email: string;
	displayName?: string;
	attributes?: { name: string; value: string[] }[];
}

export interface LLDAPUpdateUserInput {
	id: string;
	email?: string;
	displayName?: string;
	removeAttributes?: string[];
	insertAttributes?: { name: string; value: string[] }[];
}

export interface LLDAPUpdateGroupInput {
	id: number;
	displayName?: string;
	removeAttributes?: string[];
	insertAttributes?: { name: string; value: string[] }[];
}

export function toCreateUserInput(input: CreateUserInput): LLDAPCreateUserInput {
	return {
		id: input.id,
		email: input.email,
		displayName: input.displayName,
		attributes: input.attributes?.map((a) => ({
			name: a.name,
			value: a.values
		}))
	};
}

export function toUpdateUserInput(input: UpdateUserInput): LLDAPUpdateUserInput {
	return {
		id: input.id,
		email: input.email,
		displayName: input.displayName,
		removeAttributes: input.removeAttributes,
		insertAttributes: input.insertAttributes?.map((a) => ({
			name: a.name,
			value: a.values
		}))
	};
}

/**
 * Convert UpdateGroupInput to LLDAP format.
 * Note: The numericId must be resolved by the service from the uuid before calling this.
 */
export function toUpdateGroupInput(
	input: UpdateGroupInput,
	numericId: number
): LLDAPUpdateGroupInput {
	return {
		id: numericId,
		displayName: input.displayName,
		removeAttributes: input.removeAttributes,
		insertAttributes: input.insertAttributes?.map((a) => ({
			name: a.name,
			value: a.values
		}))
	};
}

// Note: createGroup in LLDAP uses simple `name` parameter, not CreateGroupInput
export function toCreateGroupName(input: CreateGroupInput): string {
	return input.displayName;
}
