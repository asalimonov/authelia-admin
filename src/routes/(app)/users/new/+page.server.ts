import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { getAccessService, Permission, EntityType, type DirectoryServiceType } from '$lib/server/access-service';
import { getDirectoryServiceAsync, type CreateUserInput } from '$lib/server/directory-service';
import { isValidEmail, isValidUsername, sanitizeString, validatePassword } from '$lib/utils/validation';
import { getConfigAsync } from '$lib/server/config';
import * as m from '$lib/paraglide/messages';

export const load: PageServerLoad = async ({ locals }) => {
    const username = locals.user?.username || '';

    try {
        const config = await getConfigAsync();
        const directoryService = await getDirectoryServiceAsync();
        const accessService = getAccessService(
            directoryService,
            config.directory.type as DirectoryServiceType
        );

        // Check if user has permission to create users
        const result = await accessService.checkWithDetails(
            username,
            Permission.USER_CREATE,
            EntityType.NONE
        );

        if (!result.allowed) {
            return {
                error: result.reason || m.user_create_no_permission(),
                canCreate: false
            };
        }

        return {
            error: null,
            canCreate: true
        };
    } catch (error) {
        console.error('Error checking create user permission:', error);
        return {
            error: m.user_permissions_check_failed({ error: (error as Error).message }),
            canCreate: false
        };
    }
};

export const actions: Actions = {
    create: async ({ request, locals }) => {
        const username = locals.user?.username || '';

        try {
            const config = await getConfigAsync();
            const directoryService = await getDirectoryServiceAsync();
            const accessService = getAccessService(
                directoryService,
                config.directory.type as DirectoryServiceType
            );

            // Check permission again before creating
            const permissionCheck = await accessService.checkWithDetails(
                username,
                Permission.USER_CREATE,
                EntityType.NONE
            );

            if (!permissionCheck.allowed) {
                return fail(403, {
                    error: permissionCheck.reason || m.user_create_no_permission()
                });
            }

            const formData = await request.formData();
            const userId = formData.get('userId')?.toString()?.trim() || '';
            const email = formData.get('email')?.toString()?.trim() || '';
            const displayName = formData.get('displayName')?.toString()?.trim() || '';
            const firstName = formData.get('firstName')?.toString()?.trim() || '';
            const lastName = formData.get('lastName')?.toString()?.trim() || '';
            const password = formData.get('password')?.toString() || '';
            const confirmPassword = formData.get('confirmPassword')?.toString() || '';
            const action = formData.get('action')?.toString() || 'create';

            // Validation
            const errors: string[] = [];

            if (!userId) {
                errors.push(m.validation_user_id_required());
            } else if (!isValidUsername(userId)) {
                errors.push(m.validation_user_id_format());
            }

            if (!email) {
                errors.push(m.validation_email_required());
            } else if (!isValidEmail(email)) {
                errors.push(m.validation_email_invalid());
            }

            if (!displayName) {
                errors.push(m.validation_display_name_required());
            }

            if (!password) {
                errors.push(m.validation_password_required());
            } else {
                const passwordValidation = validatePassword(password);
                if (!passwordValidation.isValid) {
                    errors.push(...passwordValidation.errors);
                }
            }

            if (password !== confirmPassword) {
                errors.push(m.validation_password_mismatch());
            }

            if (errors.length > 0) {
                return fail(400, {
                    error: errors.join('. '),
                    values: { userId, email, displayName, firstName, lastName }
                });
            }

            // Check if user already exists
            const existingUser = await directoryService.getUserDetails(userId);
            if (existingUser) {
                return fail(400, {
                    error: m.user_already_exists({ userId }),
                    values: { userId, email, displayName, firstName, lastName }
                });
            }

            // Check if email is already in use
            const existingEmailUser = await directoryService.getUserByEmail(email);
            if (existingEmailUser) {
                return fail(400, {
                    error: m.user_email_already_exists({ email }),
                    values: { userId, email, displayName, firstName, lastName }
                });
            }

            // Create the user
            const attributes: { name: string; values: string[] }[] = [];
            if (firstName) {
                attributes.push({ name: 'first_name', values: [sanitizeString(firstName, 255)] });
            }
            if (lastName) {
                attributes.push({ name: 'last_name', values: [sanitizeString(lastName, 255)] });
            }

            const createInput: CreateUserInput = {
                id: sanitizeString(userId, 64),
                email: sanitizeString(email, 255),
                displayName: displayName ? sanitizeString(displayName, 255) : undefined,
                attributes: attributes.length > 0 ? attributes : undefined
            };

            const newUser = await directoryService.createUser(createInput);

            // TODO: Set password via LDAP after user creation
            // The LLDAP GraphQL API doesn't support setting password during user creation
            // We need to use LDAP to set the password after the user is created

            if (action === 'createAndNew') {
                return {
                    success: true,
                    message: m.user_create_success({ userId: newUser.id }),
                    clearForm: true
                };
            }

            // Redirect to the new user's page
            throw redirect(303, `${base}/users/${newUser.id}`);
        } catch (error) {
            // Re-throw redirects
            if (error instanceof Response || (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 303)) {
                throw error;
            }

            console.error('Error creating user:', error);
            return fail(500, {
                error: m.user_create_error({ error: (error as Error).message })
            });
        }
    }
};
