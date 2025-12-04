<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { base } from '$app/paths';
	import { formatDate } from '$lib/utils/validation';
	import * as m from '$lib/paraglide/messages';

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
				passwordError = m.validation_password_mismatch();
			} else if (newPassword.length < 8) {
				passwordError = m.validation_password_min_length();
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
		<h1 class="text-2xl font-bold text-gray-900 dark:text-white">{m.user_detail_title()}</h1>
		<div class="flex gap-2">
			{#if data.canDeleteUser}
				<button
					on:click={() => (showDeleteConfirm = true)}
					class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
				>
					{m.user_detail_delete()}
				</button>
			{/if}
			{#if data.canEditUser}
				<a
					href="{base}/users/{data.user?.id}/edit"
					class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-block text-center font-medium"
				>
					{m.user_detail_edit()}
				</a>
			{/if}
			<a
				href="{base}/users"
				class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors inline-block text-center"
			>
				{m.user_detail_back()}
			</a>
		</div>
	</div>

	{#if data.error}
		<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
			<p class="text-red-800 dark:text-red-200 font-semibold">{m.common_error()}</p>
			<p class="text-red-600 dark:text-red-300">{data.error}</p>
		</div>
	{/if}

	{#if form?.error}
		<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
			<p class="text-red-800 dark:text-red-200 font-semibold">{m.common_error()}</p>
			<p class="text-red-600 dark:text-red-300">{form.error}</p>
		</div>
	{/if}

	{#if form?.success}
		<div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
			<p class="text-green-800 dark:text-green-200 font-semibold">{m.common_success()}</p>
			<p class="text-green-600 dark:text-green-300">{form.message}</p>
		</div>
	{/if}

	<!-- Delete Confirmation Modal -->
	{#if showDeleteConfirm}
		<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
				<h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">{m.user_detail_delete_confirm_title()}</h3>
				<p class="text-gray-600 dark:text-gray-400 mb-6">
					{m.user_detail_delete_confirm_text({ userId: data.user?.id || '' })}
				</p>
				<div class="flex gap-3 justify-end">
					<button
						on:click={() => (showDeleteConfirm = false)}
						class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
					>
						{m.common_cancel()}
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
							{isDeleting ? m.user_detail_deleting() : m.common_delete()}
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
				<h2 class="text-xl font-bold text-gray-900 dark:text-white">{m.user_detail_info_title()}</h2>
			</div>

			<div class="p-6">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							{m.user_detail_userid_label()}
						</span>
						<p class="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
							{data.user.id}
						</p>
					</div>

					<div>
						<span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							{m.user_detail_email_label()}
						</span>
						<p class="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
							{data.user.email || '-'}
						</p>
					</div>

					<div>
						<span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							{m.user_detail_displayname_label()}
						</span>
						<p class="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
							{data.user.displayName || '-'}
						</p>
					</div>

					<div>
						<span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							{m.user_detail_creation_date_label()}
						</span>
						<p class="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
							{formatDate(data.user.creationDate?.toISOString())}
						</p>
					</div>

					<div>
						<span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							{m.user_detail_firstname_label()}
						</span>
						<p class="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
							{getAttributeValue('first_name') || '-'}
						</p>
					</div>

					<div>
						<span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							{m.user_detail_lastname_label()}
						</span>
						<p class="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
							{getAttributeValue('last_name') || '-'}
						</p>
					</div>

					<div class="md:col-span-2">
						<span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							{m.user_detail_uuid_label()}
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
				<h2 class="text-xl font-bold text-gray-900 dark:text-white">{m.user_detail_groups_title()}</h2>
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
						{data.user.groups.length === 1
							? m.user_detail_groups_count({ count: data.user.groups.length })
							: m.user_detail_groups_count_plural({ count: data.user.groups.length })}
					</p>
				{:else}
					<p class="text-gray-600 dark:text-gray-400">
						{m.user_detail_no_groups()}
					</p>
				{/if}
			</div>
		</div>

		<!-- Password Management -->
		{#if data.canChangePassword}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-xl font-bold text-gray-900 dark:text-white">{m.user_detail_password_title()}</h2>
			</div>

			<div class="p-6">
				{#if !showPasswordForm}
					<button
						on:click={() => (showPasswordForm = true)}
						class="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
					>
						{m.user_detail_password_change_button()}
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
									{m.user_detail_password_new_label()} <span class="text-red-500">{m.common_required()}</span>
								</label>
								<input
									id="newPassword"
									name="newPassword"
									type="password"
									required
									bind:value={newPassword}
									on:input={validatePasswords}
									class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder={m.user_detail_password_new_placeholder()}
								/>
							</div>

							<div>
								<label
									for="repeatPassword"
									class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
								>
									{m.user_detail_password_confirm_label()} <span class="text-red-500">{m.common_required()}</span>
								</label>
								<input
									id="repeatPassword"
									name="repeatPassword"
									type="password"
									required
									bind:value={repeatPassword}
									on:input={validatePasswords}
									class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder={m.user_detail_password_confirm_placeholder()}
								/>
							</div>
						</div>

						{#if passwordError}
							<div class="text-red-600 dark:text-red-400 text-sm">{passwordError}</div>
						{/if}

						<!-- Password Requirements -->
						<div class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
							<p class="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
								{m.user_new_password_requirements_title()}
							</p>
							<ul class="text-sm text-blue-700 dark:text-blue-300 list-disc list-inside space-y-1">
								<li>{m.user_new_password_req_length()}</li>
								<li>{m.user_new_password_req_lowercase()}</li>
								<li>{m.user_new_password_req_uppercase()}</li>
								<li>{m.user_new_password_req_number()}</li>
							</ul>
						</div>

						<!-- Action Buttons -->
						<div class="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
							<button
								type="submit"
								disabled={isSubmittingPassword || !!passwordError || !newPassword || !repeatPassword}
								class="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
							>
								{isSubmittingPassword ? m.user_detail_password_changing() : m.user_detail_password_change_button()}
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
								{m.common_cancel()}
							</button>
						</div>
					</form>
				{/if}
			</div>
		</div>
		{/if}
	{:else}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
			<p class="text-gray-600 dark:text-gray-400">{m.user_detail_not_found()}</p>
		</div>
	{/if}
</div>
