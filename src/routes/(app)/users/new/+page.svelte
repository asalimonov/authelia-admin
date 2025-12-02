<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { base } from '$app/paths';

	export let data: PageData;
	export let form: ActionData;

	// Form fields
	let userId = form?.values?.userId || '';
	let email = form?.values?.email || '';
	let displayName = form?.values?.displayName || '';
	let firstName = form?.values?.firstName || '';
	let lastName = form?.values?.lastName || '';
	let password = '';
	let confirmPassword = '';

	// UI state
	let isSubmitting = false;
	let clientErrors: string[] = [];

	// Clear form on success when using "Create +1"
	$: if (form?.success && form?.clearForm) {
		userId = '';
		email = '';
		displayName = '';
		firstName = '';
		lastName = '';
		password = '';
		confirmPassword = '';
	}

	function validateForm(): boolean {
		clientErrors = [];

		if (!userId.trim()) {
			clientErrors.push('User ID is required');
		} else if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(userId.trim())) {
			clientErrors.push(
				'User ID must start with a letter or number and can only contain letters, numbers, dots, underscores, and hyphens'
			);
		}

		if (!email.trim()) {
			clientErrors.push('Email is required');
		} else if (
			!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(
				email.trim()
			)
		) {
			clientErrors.push('Invalid email format');
		}

		if (!password) {
			clientErrors.push('Password is required');
		} else {
			if (password.length < 8) {
				clientErrors.push('Password must be at least 8 characters');
			}
			if (password.length > 64) {
				clientErrors.push('Password must be at most 64 characters');
			}
			if (!/[a-z]/.test(password)) {
				clientErrors.push('Password must contain at least one lowercase letter');
			}
			if (!/[A-Z]/.test(password)) {
				clientErrors.push('Password must contain at least one uppercase letter');
			}
			if (!/[0-9]/.test(password)) {
				clientErrors.push('Password must contain at least one number');
			}
		}

		if (password !== confirmPassword) {
			clientErrors.push('Passwords do not match');
		}

		return clientErrors.length === 0;
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<h1 class="text-2xl font-bold text-gray-900 dark:text-white">Create New User</h1>
		<a
			href="{base}/users"
			class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors inline-block text-center"
		>
			Back to Users
		</a>
	</div>

	{#if data.error}
		<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
			<p class="text-red-800 dark:text-red-200 font-semibold">Access Denied</p>
			<p class="text-red-600 dark:text-red-300">{data.error}</p>
		</div>
	{/if}

	{#if form?.error}
		<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
			<p class="text-red-800 dark:text-red-200 font-semibold">Error</p>
			<p class="text-red-600 dark:text-red-300">{form.error}</p>
		</div>
	{/if}

	{#if clientErrors.length > 0}
		<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
			<p class="text-red-800 dark:text-red-200 font-semibold">Validation Error</p>
			<ul class="list-disc list-inside text-red-600 dark:text-red-300">
				{#each clientErrors as error}
					<li>{error}</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if form?.success}
		<div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
			<p class="text-green-800 dark:text-green-200 font-semibold">Success</p>
			<p class="text-green-600 dark:text-green-300">{form.message}</p>
		</div>
	{/if}

	{#if data.canCreate}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-xl font-bold text-gray-900 dark:text-white">User Details</h2>
				<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
					Fill in the details below to create a new user account.
				</p>
			</div>

			<div class="p-6">
				<form
					method="POST"
					action="{base}/users/new?/create"
					use:enhance={() => {
						if (!validateForm()) {
							return ({ cancel }) => cancel();
						}
						isSubmitting = true;
						return async ({ update }) => {
							isSubmitting = false;
							await update();
						};
					}}
					class="space-y-6"
				>
					<!-- User ID and Email -->
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label
								for="userId"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>
								User ID <span class="text-red-500">*</span>
							</label>
							<input
								id="userId"
								name="userId"
								type="text"
								required
								bind:value={userId}
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder="Enter user ID (username)"
							/>
							<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
								Must start with a letter or number. Only letters, numbers, dots, underscores, and hyphens allowed.
							</p>
						</div>

						<div>
							<label
								for="email"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>
								Email <span class="text-red-500">*</span>
							</label>
							<input
								id="email"
								name="email"
								type="email"
								required
								bind:value={email}
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder="user@example.com"
							/>
						</div>
					</div>

					<!-- Display Name -->
					<div>
						<label
							for="displayName"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
						>
							Display Name
						</label>
						<input
							id="displayName"
							name="displayName"
							type="text"
							bind:value={displayName}
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="John Doe (optional)"
						/>
					</div>

					<!-- First Name and Last Name -->
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label
								for="firstName"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>
								First Name
							</label>
							<input
								id="firstName"
								name="firstName"
								type="text"
								bind:value={firstName}
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder="John (optional)"
							/>
						</div>

						<div>
							<label
								for="lastName"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>
								Last Name
							</label>
							<input
								id="lastName"
								name="lastName"
								type="text"
								bind:value={lastName}
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder="Doe (optional)"
							/>
						</div>
					</div>

					<!-- Password Fields -->
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label
								for="password"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>
								Password <span class="text-red-500">*</span>
							</label>
							<input
								id="password"
								name="password"
								type="password"
								required
								bind:value={password}
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder="Enter password"
							/>
						</div>

						<div>
							<label
								for="confirmPassword"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>
								Confirm Password <span class="text-red-500">*</span>
							</label>
							<input
								id="confirmPassword"
								name="confirmPassword"
								type="password"
								required
								bind:value={confirmPassword}
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder="Confirm password"
							/>
						</div>
					</div>

					<!-- Password Requirements -->
					<div class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
						<p class="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">Password Requirements:</p>
						<ul class="text-sm text-blue-700 dark:text-blue-300 list-disc list-inside space-y-1">
							<li>At least 8 characters long</li>
							<li>At least one lowercase letter</li>
							<li>At least one uppercase letter</li>
							<li>At least one number</li>
						</ul>
					</div>

					<!-- Action Buttons -->
					<div class="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
						<button
							type="submit"
							name="action"
							value="create"
							disabled={isSubmitting}
							class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
						>
							{isSubmitting ? 'Creating...' : 'Create'}
						</button>
						<button
							type="submit"
							name="action"
							value="createAndNew"
							disabled={isSubmitting}
							class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
						>
							{isSubmitting ? 'Creating...' : 'Create +1'}
						</button>
						<a
							href="{base}/users"
							class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-center font-medium"
						>
							Cancel
						</a>
					</div>

					<p class="text-sm text-gray-500 dark:text-gray-400">
						<strong>Create</strong> will create the user and redirect to their profile page.
						<strong>Create +1</strong> will create the user and clear the form for another entry.
					</p>
				</form>
			</div>
		</div>
	{:else}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
			<p class="text-gray-600 dark:text-gray-400">
				You do not have permission to create new users.
			</p>
		</div>
	{/if}
</div>
