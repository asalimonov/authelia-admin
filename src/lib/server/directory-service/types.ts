// === Common Types ===

export type AttributeType = 'STRING' | 'INTEGER' | 'JPEG_PHOTO' | 'DATE_TIME';

export interface AttributeSchema {
	name: string;
	type: AttributeType;
	isList: boolean;
	isVisible: boolean;
	isEditable: boolean;
	isReadonly: boolean;
}

export interface AttributeValue {
	name: string;
	values: string[];
}

export interface User {
	id: string; // Unique identifier (username)
	email: string;
	displayName: string;
	uuid: string;
	creationDate: Date;
	groups: GroupSummary[]; // Groups user belongs to
	attributes: AttributeValue[];
}

export interface UserSummary {
	id: string;
	email: string;
	displayName: string;
}

/**
 * User summary with group memberships.
 * Used for bulk operations to avoid N+1 queries when checking user protection status.
 */
export interface UserWithGroups extends UserSummary {
	groups: GroupSummary[];
}

export interface Group {
	id: string; // Unique identifier (uuid for LLDAP, string ID for other implementations)
	displayName: string;
	creationDate: Date;
	members: UserSummary[]; // Users in this group
	attributes: AttributeValue[];
}

export interface GroupSummary {
	id: string;
	displayName: string;
}

// === Input Types ===

export interface CreateUserInput {
	id: string; // Required: username
	email: string; // Required
	displayName?: string;
	attributes?: AttributeValue[];
}

export interface UpdateUserInput {
	id: string; // Required: user to update
	email?: string;
	displayName?: string;
	removeAttributes?: string[]; // Attribute names to remove
	insertAttributes?: AttributeValue[];
}

export interface CreateGroupInput {
	displayName: string; // Required
	attributes?: AttributeValue[];
}

export interface UpdateGroupInput {
	id: string; // Required: group ID (uuid for LLDAP)
	displayName?: string;
	removeAttributes?: string[];
	insertAttributes?: AttributeValue[];
}

// === Result Types ===

export interface OperationResult {
	success: boolean;
	error?: string;
}

export interface Schema {
	attributes: AttributeSchema[];
}

// === Service Interface ===

export interface IDirectoryService {
	// User operations
	createUser(input: CreateUserInput): Promise<User>;
	updateUser(input: UpdateUserInput): Promise<OperationResult>;
	deleteUser(userId: string): Promise<OperationResult>;
	listUsers(): Promise<UserSummary[]>;
	listUsersWithGroups(): Promise<UserWithGroups[]>;
	getUserDetails(userId: string): Promise<User | null>;
	getUserByEmail(email: string): Promise<User | null>;
	changePassword(userId: string, newPassword: string): Promise<OperationResult>;

	// Group operations
	createGroup(input: CreateGroupInput): Promise<Group>;
	updateGroup(input: UpdateGroupInput): Promise<OperationResult>;
	deleteGroup(groupId: string): Promise<OperationResult>;
	listGroups(): Promise<GroupSummary[]>;
	getGroupDetails(groupId: string): Promise<Group | null>;

	// Membership operations
	addUserToGroup(userId: string, groupId: string): Promise<OperationResult>;
	removeUserFromGroup(userId: string, groupId: string): Promise<OperationResult>;

	// Schema operations
	getUserAttributesSchema(): Promise<Schema>;
	getGroupAttributesSchema(): Promise<Schema>;

	// Connection test
	testConnection(): Promise<OperationResult>;
}
