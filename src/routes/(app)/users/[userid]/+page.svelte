<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { base } from '$app/paths';
	import { formatDate } from '$lib/utils/validation';

	export let data: PageData;
	export let form: ActionData;

	// Helper to get attribute value by name
	function getAttributeValue(name: string): string {
		const attr = data.user?.attributes?.find(a => a.name === name);
		return attr?.values?.[0] || '';
	}

	let showPasswordForm = false;
	let isSubmittingPassword = false;
	let showDeleteConfirm = false;
	let isDeleting = false;

	// Password fields
	let newPassword = '';
	let repeatPassword = '';
	let passwordError = '';

	function validatePasswords() {
		passwordError = '';

		if (newPassword && repeatPassword) {
			if (newPassword !== repeatPassword) {
				passwordError = 'Passwords do not match';
			} else if (newPassword.length < 8) {
				passwordError = 'Password must be at least 8 characters long';
			}
		}
	}

	$: if (form?.success && form?.type === 'password') {
		// Reset password form on success
		showPasswordForm = false;
		newPassword = '';
		repeatPassword = '';
		passwordError = '';
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<h1 class="text-2xl font-bold text-gray-900 dark:text-white">User Details</h1>
		<div class="flex gap-2">
			{#if data.canEditUser}
				<a
					href="{base}/users/{data.user?.id}/edit"
					class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-block text-center font-medium"
				>
					Edit
				</a>
			{/if}
			{#if data.canDeleteUser}
				<button
					on:click={() => (showDeleteConfirm = true)}
					class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
				>
					Delete
				</button>
			{/if}
			<a
				href="{base}/users"
				class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors inline-block text-center"
			>
				Back to Users
			</a>
		</div>
	</div>

	{#if data.error}
		<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
			<p class="text-red-800 dark:text-red-200 font-semibold">Error</p>
			<p class="text-red-600 dark:text-red-300">{data.error}</p>
		</div>
	{/if}

	{#if form?.error}
		<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
			<p class="text-red-800 dark:text-red-200 font-semibold">Error</p>
			<p class="text-red-600 dark:text-red-300">{form.error}</p>
		</div>
	{/if}

	{#if form?.success}
		<div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
			<p class="text-green-800 dark:text-green-200 font-semibold">Success</p>
			<p class="text-green-600 dark:text-green-300">{form.message}</p>
		</div>
	{/if}

	<!-- Delete Confirmation Modal -->
	{#if showDeleteConfirm}
		<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
				<h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Confirm Delete</h3>
				<p class="text-gray-600 dark:text-gray-400 mb-6">
					Are you sure you want to delete user <strong>{data.user?.id}</strong>? This action cannot be undone.
				</p>
				<div class="flex gap-3 justify-end">
					<button
						on:click={() => (showDeleteConfirm = false)}
						class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
					>
						Cancel
					</button>
					<form
						method="POST"
						action="{base}/users/{data.user?.id}?/deleteUser"
						use:enhance={() => {
							isDeleting = true;
							return async ({ update }) => {
								isDeleting = false;
								await update();
							};
						}}
					>
						<button
							type="submit"
							disabled={isDeleting}
							class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
						>
							{isDeleting ? 'Deleting...' : 'Delete'}
						</button>
					</form>
				</div>
			</div>
		</div>
	{/if}

	{#if data.user}
		<!-- User Information -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-xl font-bold text-gray-900 dark:text-white">User Information</h2>
			</div>

			<div class="p-6">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							User ID
						</span>
						<p class="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
							{data.user.id}
						</p>
					</div>

					<div>
						<span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Email
						</span>
						<p class="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
							{data.user.email || '-'}
						</p>
					</div>

					<div>
						<span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Display Name
						</span>
						<p class="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
							{data.user.displayName || '-'}
						</p>
					</div>

					<div>
						<span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Creation Date
						</span>
						<p class="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
							{formatDate(data.user.creationDate?.toISOString())}
						</p>
					</div>

					<div>
						<span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							First Name
						</span>
						<p class="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
							{getAttributeValue('first_name') || '-'}
						</p>
					</div>

					<div>
						<span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Last Name
						</span>
						<p class="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
							{getAttributeValue('last_name') || '-'}
						</p>
					</div>

					<div class="md:col-span-2">
						<span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							UUID
						</span>
						<p class="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white font-mono text-sm">
							{data.user.uuid}
						</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Group Membership -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-xl font-bold text-gray-900 dark:text-white">Group Membership</h2>
			</div>

			<div class="p-6">
				{#if data.user.groups && data.user.groups.length > 0}
					<div class="flex flex-wrap gap-2">
						{#each data.user.groups as group}
							<span class="px-3 py-2 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-lg">
								{group.displayName}
							</span>
						{/each}
					</div>
					<p class="mt-3 text-sm text-gray-600 dark:text-gray-400">
						Member of {data.user.groups.length} group{data.user.groups.length !== 1 ? 's' : ''}
					</p>
				{:else}
					<p class="text-gray-600 dark:text-gray-400">
						This user is not a member of any groups.
					</p>
				{/if}
			</div>
		</div>

		<!-- Password Management -->
		{#if data.canChangePassword}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-xl font-bold text-gray-900 dark:text-white">Password Management</h2>
			</div>

			<div class="p-6">
				{#if !showPasswordForm}
					<button
						on:click={() => (showPasswordForm = true)}
						class="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
					>
						Change Password
					</button>
				{:else}
					<form
						method="POST"
						action="{base}/users/{data.user.id}?/changePassword"
						use:enhance={() => {
							isSubmittingPassword = true;
							return async ({ update }) => {
								isSubmittingPassword = false;
								await update();
							};
						}}
						class="space-y-6"
					>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label
									for="newPassword"
									class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
								>
									New Password <span class="text-red-500">*</span>
								</label>
								<input
									id="newPassword"
									name="newPassword"
									type="password"
									required
									bind:value={newPassword}
									on:input={validatePasswords}
									class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Enter new password"
								/>
							</div>

							<div>
								<label
									for="repeatPassword"
									class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
								>
									Confirm Password <span class="text-red-500">*</span>
								</label>
								<input
									id="repeatPassword"
									name="repeatPassword"
									type="password"
									required
									bind:value={repeatPassword}
									on:input={validatePasswords}
									class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Confirm new password"
								/>
							</div>
						</div>

						{#if passwordError}
							<div class="text-red-600 dark:text-red-400 text-sm">{passwordError}</div>
						{/if}

						<!-- Password Requirements -->
						<div class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
							<p class="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
								Password Requirements:
							</p>
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
								disabled={isSubmittingPassword || !!passwordError || !newPassword || !repeatPassword}
								class="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
							>
								{isSubmittingPassword ? 'Changing...' : 'Change Password'}
							</button>
							<button
								type="button"
								on:click={() => {
									showPasswordForm = false;
									newPassword = '';
									repeatPassword = '';
									passwordError = '';
								}}
								class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
							>
								Cancel
							</button>
						</div>
					</form>
				{/if}
			</div>
		</div>
		{/if}
	{:else}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
			<p class="text-gray-600 dark:text-gray-400">User not found.</p>
		</div>
	{/if}
</div>
