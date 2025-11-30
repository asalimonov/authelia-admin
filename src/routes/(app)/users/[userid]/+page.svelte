<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { base } from '$app/paths';
	import { formatDate } from '$lib/utils/validation';

	export let data: PageData;
	export let form: ActionData;

	function extractGroupName(dn: string): string {
		// Extract CN from DN string like "cn=admins,ou=groups,dc=localhost,dc=test"
		const match = dn.match(/cn=([^,]+)/i);
		return match ? match[1] : dn;
	}
	
	let showPasswordForm = false;
	let isSubmittingPassword = false;
	
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
	<div class="flex items-center justify-between">
		<h1 class="text-2xl font-bold text-gray-900 dark:text-white">User details</h1>
		<a 
			href="{base}/users"
			class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
		>
			Back to Users
		</a>
	</div>
	
	{#if data.error}
		<div class="bg-red-50 border border-red-200 rounded-lg p-4">
			<p class="text-red-800 font-semibold">Error</p>
			<p class="text-red-600">{data.error}</p>
		</div>
	{/if}
	
	{#if form?.error}
		<div class="bg-red-50 border border-red-200 rounded-lg p-4">
			<p class="text-red-800 font-semibold">Error</p>
			<p class="text-red-600">{form.error}</p>
		</div>
	{/if}
	
	{#if form?.success}
		<div class="bg-green-50 border border-green-200 rounded-lg p-4">
			<p class="text-green-800 font-semibold">Success</p>
			<p class="text-green-600">{form.message}</p>
		</div>
	{/if}
	
	{#if data.user}
		<!-- User Information (All fields read-only) -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-xl font-bold text-gray-900 dark:text-white">
					User Information
				</h2>
			</div>
			
			<div class="p-6">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label for="user-id" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							User ID
						</label>
						<input
							id="user-id"
							type="text"
							value={data.user.uid}
							readonly
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed"
						/>
					</div>
					
					<div>
						<label for="display-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Display Name
						</label>
						<input
							id="display-name"
							type="text"
							value={data.user.displayName || ''}
							readonly
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed"
						/>
					</div>
					
					<div>
						<label for="user-email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Email
						</label>
						<input
							id="user-email"
							type="email"
							value={data.user.mail || ''}
							readonly
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed"
						/>
					</div>
					
					<div>
						<label for="creation-date" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Creation Date
						</label>
						<input
							id="creation-date"
							type="text"
							value={formatDate(data.user.createTimestamp)}
							readonly
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed"
						/>
					</div>

					<div>
						<label for="first-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							First Name
						</label>
						<input
							id="first-name"
							type="text"
							value={data.user.givenName || ''}
							readonly
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed"
						/>
					</div>
					
					<div>
						<label for="last-name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							Last Name
						</label>
						<input
							id="last-name"
							type="text"
							value={data.user.sn || ''}
							readonly
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed"
						/>
					</div>
					

					
					<div class="md:col-span-2">
						<label for="user-uuid" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							UUID
						</label>
						<input
							id="user-uuid"
							type="text"
							value={data.user.entryUUID}
							readonly
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed font-mono text-sm"
						/>
					</div>
				</div>
				
				<div class="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
					<p class="text-sm text-yellow-800 dark:text-yellow-200">
						Note: LLDAP does not support user data modification via LDAP protocol except password changes.
					</p>
				</div>
			</div>
		</div>
		
		<!-- User Groups -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-xl font-bold text-gray-900 dark:text-white">
					Group Membership
				</h2>
			</div>
			
			<div class="p-6">
				{#if data.user.memberOf && data.user.memberOf.length > 0}
					<div class="flex flex-wrap gap-2">
						{#each data.user.memberOf as group}
							<span class="px-3 py-2 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-lg">
								{extractGroupName(group)}
							</span>
						{/each}
					</div>
					<div class="mt-3 text-sm text-gray-600 dark:text-gray-400">
						Member of {data.user.memberOf.length} group{data.user.memberOf.length !== 1 ? 's' : ''}
					</div>
				{:else}
					<div class="text-gray-600 dark:text-gray-400">
						This user is not a member of any groups.
					</div>
				{/if}
			</div>
		</div>
		
		<!-- Password Change Section -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-xl font-bold text-gray-900 dark:text-white">
					Password Management
				</h2>
			</div>
			
			<div class="p-6">
				{#if !showPasswordForm}
					<button
						on:click={() => showPasswordForm = true}
						class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
					>
						Change Password
					</button>
				{:else}
					<form
						method="POST"
						action="{base}/users/{data.user.uid}?/changePassword"
						use:enhance={() => {
							isSubmittingPassword = true;
							return async ({ update }) => {
								isSubmittingPassword = false;
								await update();
							};
						}}
						class="space-y-4"
					>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label for="newPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
								<label for="repeatPassword" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Repeat Password <span class="text-red-500">*</span>
								</label>
								<input
									id="repeatPassword"
									name="repeatPassword"
									type="password"
									required
									bind:value={repeatPassword}
									on:input={validatePasswords}
									class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Repeat new password"
								/>
							</div>
						</div>
						
						{#if passwordError}
							<div class="text-red-600 text-sm">{passwordError}</div>
						{/if}
						
						<div class="text-sm text-gray-600 dark:text-gray-400">
							Password must be at least 8 characters long.
						</div>
						
						<div class="flex gap-2">
							<button
								type="submit"
								disabled={isSubmittingPassword || !!passwordError || !newPassword || !repeatPassword}
								class="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
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
								class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
							>
								Cancel
							</button>
						</div>
					</form>
				{/if}
			</div>
		</div>
	{:else}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
			<p class="text-gray-600 dark:text-gray-400">User not found.</p>
		</div>
	{/if}
</div>