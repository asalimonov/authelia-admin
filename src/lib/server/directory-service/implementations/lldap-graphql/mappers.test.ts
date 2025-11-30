import { describe, it, expect } from 'vitest';
import {
	mapUser,
	mapUserSummary,
	mapGroup,
	mapGroupSummary,
	mapAttributeValue,
	mapAttributeSchema,
	toCreateUserInput,
	toUpdateUserInput,
	toUpdateGroupInput,
	toCreateGroupName,
	type LLDAPUser,
	type LLDAPUserSummary,
	type LLDAPGroup,
	type LLDAPGroupSummary,
	type LLDAPAttributeValue,
	type LLDAPAttributeSchema
} from './mappers';
import type { CreateUserInput, UpdateUserInput, UpdateGroupInput, CreateGroupInput } from '../../types';

describe('mappers', () => {
	describe('mapUser', () => {
		it('should map LLDAP user to common User type', () => {
			const lldapUser: LLDAPUser = {
				id: 'testuser',
				email: 'test@example.com',
				displayName: 'Test User',
				uuid: '550e8400-e29b-41d4-a716-446655440000',
				creationDate: '2024-01-15T10:30:00Z',
				groups: [
					{ id: 1, displayName: 'admins', uuid: 'group-uuid-1' },
					{ id: 2, displayName: 'users', uuid: 'group-uuid-2' }
				],
				attributes: [
					{ name: 'first_name', value: ['Test'] },
					{ name: 'last_name', value: ['User'] }
				]
			};

			const result = mapUser(lldapUser);

			expect(result.id).toBe('testuser');
			expect(result.email).toBe('test@example.com');
			expect(result.displayName).toBe('Test User');
			expect(result.uuid).toBe('550e8400-e29b-41d4-a716-446655440000');
			expect(result.creationDate).toBeInstanceOf(Date);
			expect(result.creationDate.toISOString()).toBe('2024-01-15T10:30:00.000Z');
			expect(result.groups).toHaveLength(2);
			expect(result.groups[0]).toEqual({ id: 'group-uuid-1', displayName: 'admins' });
			expect(result.groups[1]).toEqual({ id: 'group-uuid-2', displayName: 'users' });
			expect(result.attributes).toHaveLength(2);
			expect(result.attributes[0]).toEqual({ name: 'first_name', values: ['Test'] });
			expect(result.attributes[1]).toEqual({ name: 'last_name', values: ['User'] });
		});

		it('should handle empty groups and attributes', () => {
			const lldapUser: LLDAPUser = {
				id: 'emptyuser',
				email: 'empty@example.com',
				displayName: 'Empty User',
				uuid: '550e8400-e29b-41d4-a716-446655440001',
				creationDate: '2024-01-15T10:30:00Z',
				groups: [],
				attributes: []
			};

			const result = mapUser(lldapUser);

			expect(result.groups).toHaveLength(0);
			expect(result.attributes).toHaveLength(0);
		});
	});

	describe('mapUserSummary', () => {
		it('should map LLDAP user summary to common UserSummary type', () => {
			const lldapUserSummary: LLDAPUserSummary = {
				id: 'testuser',
				email: 'test@example.com',
				displayName: 'Test User'
			};

			const result = mapUserSummary(lldapUserSummary);

			expect(result.id).toBe('testuser');
			expect(result.email).toBe('test@example.com');
			expect(result.displayName).toBe('Test User');
		});
	});

	describe('mapGroup', () => {
		it('should map LLDAP group to common Group type with uuid as id', () => {
			const lldapGroup: LLDAPGroup = {
				id: 1,
				displayName: 'admins',
				uuid: '550e8400-e29b-41d4-a716-446655440002',
				creationDate: '2024-01-10T08:00:00Z',
				users: [
					{ id: 'admin', email: 'admin@example.com', displayName: 'Admin User' },
					{ id: 'test', email: 'test@example.com', displayName: 'Test User' }
				],
				attributes: [{ name: 'description', value: ['Administrators group'] }]
			};

			const result = mapGroup(lldapGroup);

			expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440002'); // uuid as id
			expect(result.displayName).toBe('admins');
			expect(result.creationDate).toBeInstanceOf(Date);
			expect(result.creationDate.toISOString()).toBe('2024-01-10T08:00:00.000Z');
			expect(result.members).toHaveLength(2);
			expect(result.members[0]).toEqual({
				id: 'admin',
				email: 'admin@example.com',
				displayName: 'Admin User'
			});
			expect(result.attributes).toHaveLength(1);
			expect(result.attributes[0]).toEqual({
				name: 'description',
				values: ['Administrators group']
			});
		});

		it('should handle empty users and attributes', () => {
			const lldapGroup: LLDAPGroup = {
				id: 2,
				displayName: 'empty',
				uuid: '550e8400-e29b-41d4-a716-446655440003',
				creationDate: '2024-01-10T08:00:00Z',
				users: [],
				attributes: []
			};

			const result = mapGroup(lldapGroup);

			expect(result.id).toBe('550e8400-e29b-41d4-a716-446655440003'); // uuid as id
			expect(result.members).toHaveLength(0);
			expect(result.attributes).toHaveLength(0);
		});
	});

	describe('mapGroupSummary', () => {
		it('should map LLDAP group summary to common GroupSummary type with uuid as id', () => {
			const lldapGroupSummary: LLDAPGroupSummary = {
				id: 1,
				displayName: 'admins',
				uuid: 'group-uuid-admins'
			};

			const result = mapGroupSummary(lldapGroupSummary);

			expect(result.id).toBe('group-uuid-admins'); // uuid as id
			expect(result.displayName).toBe('admins');
		});
	});

	describe('mapAttributeValue', () => {
		it('should map LLDAP attribute value to common AttributeValue type', () => {
			const attr: LLDAPAttributeValue = {
				name: 'department',
				value: ['Engineering', 'Research']
			};

			const result = mapAttributeValue(attr);

			expect(result.name).toBe('department');
			expect(result.values).toEqual(['Engineering', 'Research']);
		});

		it('should handle single value attributes', () => {
			const attr: LLDAPAttributeValue = {
				name: 'title',
				value: ['Engineer']
			};

			const result = mapAttributeValue(attr);

			expect(result.name).toBe('title');
			expect(result.values).toEqual(['Engineer']);
		});

		it('should handle empty value arrays', () => {
			const attr: LLDAPAttributeValue = {
				name: 'empty_attr',
				value: []
			};

			const result = mapAttributeValue(attr);

			expect(result.name).toBe('empty_attr');
			expect(result.values).toEqual([]);
		});
	});

	describe('mapAttributeSchema', () => {
		it('should map LLDAP attribute schema to common AttributeSchema type', () => {
			const schema: LLDAPAttributeSchema = {
				name: 'first_name',
				attributeType: 'STRING',
				isList: false,
				isVisible: true,
				isEditable: true,
				isReadonly: false
			};

			const result = mapAttributeSchema(schema);

			expect(result.name).toBe('first_name');
			expect(result.type).toBe('STRING');
			expect(result.isList).toBe(false);
			expect(result.isVisible).toBe(true);
			expect(result.isEditable).toBe(true);
			expect(result.isReadonly).toBe(false);
		});

		it('should handle list attributes', () => {
			const schema: LLDAPAttributeSchema = {
				name: 'groups',
				attributeType: 'STRING',
				isList: true,
				isVisible: true,
				isEditable: false,
				isReadonly: true
			};

			const result = mapAttributeSchema(schema);

			expect(result.isList).toBe(true);
			expect(result.isEditable).toBe(false);
			expect(result.isReadonly).toBe(true);
		});
	});

	describe('toCreateUserInput', () => {
		it('should convert CreateUserInput to LLDAP format', () => {
			const input: CreateUserInput = {
				id: 'newuser',
				email: 'new@example.com',
				displayName: 'New User',
				attributes: [
					{ name: 'first_name', values: ['New'] },
					{ name: 'last_name', values: ['User'] }
				]
			};

			const result = toCreateUserInput(input);

			expect(result.id).toBe('newuser');
			expect(result.email).toBe('new@example.com');
			expect(result.displayName).toBe('New User');
			expect(result.attributes).toHaveLength(2);
			expect(result.attributes![0]).toEqual({ name: 'first_name', value: ['New'] });
			expect(result.attributes![1]).toEqual({ name: 'last_name', value: ['User'] });
		});

		it('should handle input without attributes', () => {
			const input: CreateUserInput = {
				id: 'simpleuser',
				email: 'simple@example.com'
			};

			const result = toCreateUserInput(input);

			expect(result.id).toBe('simpleuser');
			expect(result.email).toBe('simple@example.com');
			expect(result.displayName).toBeUndefined();
			expect(result.attributes).toBeUndefined();
		});
	});

	describe('toUpdateUserInput', () => {
		it('should convert UpdateUserInput to LLDAP format', () => {
			const input: UpdateUserInput = {
				id: 'testuser',
				email: 'updated@example.com',
				displayName: 'Updated User',
				removeAttributes: ['old_attr'],
				insertAttributes: [{ name: 'new_attr', values: ['value1', 'value2'] }]
			};

			const result = toUpdateUserInput(input);

			expect(result.id).toBe('testuser');
			expect(result.email).toBe('updated@example.com');
			expect(result.displayName).toBe('Updated User');
			expect(result.removeAttributes).toEqual(['old_attr']);
			expect(result.insertAttributes).toHaveLength(1);
			expect(result.insertAttributes![0]).toEqual({ name: 'new_attr', value: ['value1', 'value2'] });
		});

		it('should handle minimal update input', () => {
			const input: UpdateUserInput = {
				id: 'testuser'
			};

			const result = toUpdateUserInput(input);

			expect(result.id).toBe('testuser');
			expect(result.email).toBeUndefined();
			expect(result.displayName).toBeUndefined();
			expect(result.removeAttributes).toBeUndefined();
			expect(result.insertAttributes).toBeUndefined();
		});
	});

	describe('toUpdateGroupInput', () => {
		it('should convert UpdateGroupInput to LLDAP format with numeric id', () => {
			const input: UpdateGroupInput = {
				id: 'group-uuid-1', // uuid in interface
				displayName: 'Updated Group',
				removeAttributes: ['old_desc'],
				insertAttributes: [{ name: 'description', values: ['New description'] }]
			};
			const numericId = 1; // Resolved by service

			const result = toUpdateGroupInput(input, numericId);

			expect(result.id).toBe(1); // Uses numeric id for LLDAP
			expect(result.displayName).toBe('Updated Group');
			expect(result.removeAttributes).toEqual(['old_desc']);
			expect(result.insertAttributes).toHaveLength(1);
			expect(result.insertAttributes![0]).toEqual({
				name: 'description',
				value: ['New description']
			});
		});

		it('should handle minimal update input', () => {
			const input: UpdateGroupInput = {
				id: 'group-uuid-2' // uuid in interface
			};
			const numericId = 2; // Resolved by service

			const result = toUpdateGroupInput(input, numericId);

			expect(result.id).toBe(2); // Uses numeric id for LLDAP
			expect(result.displayName).toBeUndefined();
			expect(result.removeAttributes).toBeUndefined();
			expect(result.insertAttributes).toBeUndefined();
		});
	});

	describe('toCreateGroupName', () => {
		it('should extract displayName for group creation', () => {
			const input: CreateGroupInput = {
				displayName: 'New Group'
			};

			const result = toCreateGroupName(input);

			expect(result).toBe('New Group');
		});
	});
});
