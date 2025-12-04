<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { base } from '$app/paths';
	import * as m from '$lib/paraglide/messages';

	export let data: PageData;
	export let form: ActionData;

	// Helper to get attribute value by name
	function getAttributeValue(name: string): string {
		const attr = data.user?.attributes?.find(a => a.name === name);
		return attr?.values?.[0] || '';
	}

	// Get groups the user is NOT a member of (for adding)
	function getAvailableGroups() {
		if (!data.allGroups || !data.user?.groups) return data.allGroups || [];
		const memberGroupIds = new Set(data.user.groups.map(g => g.id));
		return data.allGroups.filter(g => !memberGroupIds.has(g.id));
	}

	// Form fields - initialize with current values
	let email = data.user?.email || '';
	let displayName = data.user?.displayName || '';
	let firstName = getAttributeValue('first_name');
	let lastName = getAttributeValue('last_name');

	// UI state
	let isSubmitting = false;
	let isSubmittingMembership = false;

	$: availableGroups = getAvailableGroups();
</script>

<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<h1 class="text-2xl font-bold text-gray-900 dark:text-white">{m.user_edit_title()}</h1>
		<a
			href="{base}/users/{data.user?.id}"
			class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors inline-block text-center"
		>
			{m.user_edit_back()}
		</a>
	</div>

	{#if data.error}
		<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
			<p class="text-red-800 dark:text-red-200 font-semibold">{m.common_access_denied()}</p>
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

	{#if data.user}
		<!-- User Details Form -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-xl font-bold text-gray-900 dark:text-white">{m.user_edit_section_title()}</h2>
				<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
					{m.user_edit_section_subtitle()}
				</p>
			</div>

			<div class="p-6">
				<form
					method="POST"
					action="{base}/users/{data.user.id}/edit?/updateDetails"
					use:enhance={() => {
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
								{m.user_edit_userid_label()}
							</label>
							<input
								id="userId"
								type="text"
								value={data.user.id}
								readonly
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white cursor-not-allowed"
							/>
							<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
								{m.user_edit_userid_readonly()}
							</p>
						</div>

						<div>
							<label
								for="email"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>
								{m.user_edit_email_label()}
							</label>
							<input
								id="email"
								name="email"
								type="email"
								bind:value={email}
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder={m.user_edit_email_placeholder()}
							/>
						</div>
					</div>

					<!-- Display Name -->
					<div>
						<label
							for="displayName"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
						>
							{m.user_edit_displayname_label()}
						</label>
						<input
							id="displayName"
							name="displayName"
							type="text"
							bind:value={displayName}
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder={m.user_edit_displayname_placeholder()}
						/>
					</div>

					<!-- First Name and Last Name -->
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label
								for="firstName"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>
								{m.user_edit_firstname_label()}
							</label>
							<input
								id="firstName"
								name="firstName"
								type="text"
								bind:value={firstName}
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder={m.user_edit_firstname_placeholder()}
							/>
						</div>

						<div>
							<label
								for="lastName"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>
								{m.user_edit_lastname_label()}
							</label>
							<input
								id="lastName"
								name="lastName"
								type="text"
								bind:value={lastName}
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder={m.user_edit_lastname_placeholder()}
							/>
						</div>
					</div>

					<!-- Action Buttons -->
					<div class="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
						<button
							type="submit"
							disabled={isSubmitting}
							class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
						>
							{isSubmitting ? m.user_edit_button_saving() : m.user_edit_button_save()}
						</button>
						<a
							href="{base}/users/{data.user.id}"
							class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-center font-medium"
						>
							{m.user_edit_button_cancel()}
						</a>
					</div>
				</form>
			</div>
		</div>

		<!-- Group Membership -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-xl font-bold text-gray-900 dark:text-white">{m.user_edit_groups_title()}</h2>
				{#if data.canManageGroups}
					<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
						{m.user_edit_groups_hint()}
					</p>
				{/if}
			</div>

			<div class="p-6 space-y-6">
				<!-- Current Groups -->
				<div>
					<h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
						{m.user_edit_groups_current_title()}
					</h3>
					{#if data.user.groups && data.user.groups.length > 0}
						<div class="flex flex-wrap gap-2">
							{#each data.user.groups as group}
								{#if data.canManageGroups}
									<form
										method="POST"
										action="{base}/users/{data.user.id}/edit?/removeFromGroup"
										use:enhance={() => {
											isSubmittingMembership = true;
											return async ({ update }) => {
												isSubmittingMembership = false;
												await update();
											};
										}}
										class="inline"
									>
										<input type="hidden" name="groupId" value={group.id} />
										<button
											type="submit"
											disabled={isSubmittingMembership}
											class="group px-3 py-2 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-lg hover:bg-red-100 hover:text-red-800 dark:hover:bg-red-900 dark:hover:text-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
											title={m.user_edit_groups_remove_hint()}
										>
											<span>{group.displayName}</span>
											<svg class="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
									</form>
								{:else}
									<span class="px-3 py-2 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-lg">
										{group.displayName}
									</span>
								{/if}
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

				<!-- Available Groups (for adding) -->
				{#if data.canManageGroups && availableGroups.length > 0}
					<div class="pt-4 border-t border-gray-200 dark:border-gray-700">
						<h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
							{m.user_edit_groups_available_title()}
						</h3>
						<div class="flex flex-wrap gap-2">
							{#each availableGroups as group}
								<form
									method="POST"
									action="{base}/users/{data.user.id}/edit?/addToGroup"
									use:enhance={() => {
										isSubmittingMembership = true;
										return async ({ update }) => {
											isSubmittingMembership = false;
											await update();
										};
									}}
									class="inline"
								>
									<input type="hidden" name="groupId" value={group.id} />
									<button
										type="submit"
										disabled={isSubmittingMembership}
										class="group px-3 py-2 bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 rounded-lg hover:bg-green-100 hover:text-green-800 dark:hover:bg-green-900 dark:hover:text-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
										title={m.user_edit_groups_add_hint()}
									>
										<svg class="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
										</svg>
										<span>{group.displayName}</span>
									</button>
								</form>
							{/each}
						</div>
					</div>
				{/if}

				{#if data.canManageGroups && availableGroups.length === 0 && data.user.groups && data.user.groups.length > 0}
					<div class="pt-4 border-t border-gray-200 dark:border-gray-700">
						<p class="text-sm text-gray-500 dark:text-gray-400">
							{m.user_edit_groups_all_assigned()}
						</p>
					</div>
				{/if}

				{#if !data.canManageGroups}
					<div class="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
						<p class="text-sm text-yellow-800 dark:text-yellow-200">
							{m.user_edit_groups_no_permission()}
						</p>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
			<p class="text-gray-600 dark:text-gray-400">
				{m.user_edit_no_permission()}
			</p>
		</div>
	{/if}
</div>
