<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { base } from '$app/paths';
	import { formatDate } from '$lib/utils/validation';
	import * as m from '$lib/paraglide/messages';

	export let data: PageData;
	export let form: ActionData;

	// Get users not in this group (for adding)
	function getAvailableUsers() {
		if (!data.allUsers || !data.group?.members) return data.allUsers || [];
		const memberIds = new Set(data.group.members.map(m => m.id));
		return data.allUsers.filter(u => !memberIds.has(u.id));
	}

	// UI state
	let showDeleteConfirm = false;
	let isDeleting = false;
	let isSubmittingMembership = false;

	$: availableUsers = getAvailableUsers();
	$: hasMembers = data.group?.members && data.group.members.length > 0;
</script>

<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<h1 class="text-2xl font-bold text-gray-900 dark:text-white">{m.group_detail_title()}</h1>
		<div class="flex gap-2">
			{#if data.canDeleteGroup && !hasMembers}
				<button
					on:click={() => (showDeleteConfirm = true)}
					class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
				>
					{m.group_detail_delete()}
				</button>
			{/if}
			{#if data.canEditGroup}
				<a
					href="{base}/groups/{data.group?.id}/edit"
					class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-block text-center font-medium"
				>
					{m.group_detail_edit()}
				</a>
			{/if}
			<a
				href="{base}/groups"
				class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors inline-block text-center"
			>
				{m.group_detail_back()}
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
				<h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">{m.group_delete_confirm_title()}</h3>
				<p class="text-gray-600 dark:text-gray-400 mb-6">
					{m.group_delete_confirm_text({ displayName: data.group?.displayName || '' })}
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
						action="{base}/groups/{data.group?.id}?/deleteGroup"
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
							{isDeleting ? m.group_detail_deleting() : m.group_detail_delete()}
						</button>
					</form>
				</div>
			</div>
		</div>
	{/if}

	{#if data.group}
		<!-- Group Information -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-xl font-bold text-gray-900 dark:text-white">{m.group_detail_info_title()}</h2>
			</div>

			<div class="p-6">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							{m.group_detail_displayname_label()}
						</span>
						<p class="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
							{data.group.displayName}
						</p>
					</div>

					<div>
						<span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							{m.group_detail_creation_date_label()}
						</span>
						<p class="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
							{formatDate(data.group.creationDate?.toISOString())}
						</p>
					</div>

					<div class="md:col-span-2">
						<span class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
							{m.group_detail_uuid_label()}
						</span>
						<p class="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white font-mono text-sm">
							{data.group.id}
						</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Group Members -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-xl font-bold text-gray-900 dark:text-white">{m.group_detail_members_title()}</h2>
				<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
					{#if hasMembers}
						{data.group.members.length === 1 ? m.group_detail_members_count({ count: 1 }) : m.group_detail_members_count_plural({ count: data.group.members.length })}
					{:else}
						{m.group_detail_members_no_members()}
					{/if}
				</p>
			</div>

			<div class="p-6">
				{#if hasMembers}
					<div class="overflow-x-auto">
						<table class="w-full">
							<thead class="bg-gray-50 dark:bg-gray-700">
								<tr>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
										{m.group_detail_members_table_userid()}
									</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
										{m.group_detail_members_table_displayname()}
									</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
										{m.group_detail_members_table_email()}
									</th>
									{#if data.canRemoveMembers}
										<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
											{m.group_detail_members_table_actions()}
										</th>
									{/if}
								</tr>
							</thead>
							<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
								{#each data.group.members as member}
									{@const canRemove = data.userPermissions[member.id]?.canRemove ?? false}
									<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
										<td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
											<a href="{base}/users/{member.id}" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
												{member.id}
											</a>
										</td>
										<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
											{member.displayName || '-'}
										</td>
										<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
											{member.email || '-'}
										</td>
										{#if data.canRemoveMembers}
											<td class="px-4 py-3 whitespace-nowrap text-sm">
												{#if canRemove}
													<form
														method="POST"
														action="{base}/groups/{data.group.id}?/removeUser"
														use:enhance={() => {
															isSubmittingMembership = true;
															return async ({ update }) => {
																isSubmittingMembership = false;
																await update();
															};
														}}
														class="inline"
													>
														<input type="hidden" name="userId" value={member.id} />
														<button
															type="submit"
															disabled={isSubmittingMembership}
															class="px-3 py-1 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 rounded hover:bg-red-200 dark:hover:bg-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
															title={m.group_detail_remove()}
														>
															{m.group_detail_remove()}
														</button>
													</form>
												{:else}
													<span class="px-3 py-1 bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 rounded text-xs">
														{m.group_detail_protected()}
													</span>
												{/if}
											</td>
										{/if}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<p class="text-gray-600 dark:text-gray-400">
						{m.group_detail_no_members()}
					</p>
				{/if}
			</div>
		</div>

		<!-- Available Users (for adding) -->
		{#if data.canAddMembers && availableUsers.length > 0}
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
				<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
					<h2 class="text-xl font-bold text-gray-900 dark:text-white">{m.group_detail_available_users()}</h2>
					<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
						{m.group_detail_available_users_hint()}
					</p>
				</div>

				<div class="p-6">
					<div class="overflow-x-auto">
						<table class="w-full">
							<thead class="bg-gray-50 dark:bg-gray-700">
								<tr>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
										{m.group_detail_members_table_userid()}
									</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
										{m.group_detail_members_table_displayname()}
									</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
										{m.group_detail_members_table_email()}
									</th>
									<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">

									</th>
								</tr>
							</thead>
							<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
								{#each availableUsers as user}
									{@const canAdd = data.userPermissions[user.id]?.canAdd ?? false}
									<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
										<td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
											<a href="{base}/users/{user.id}" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
												{user.id}
											</a>
										</td>
										<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
											{user.displayName || '-'}
										</td>
										<td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
											{user.email || '-'}
										</td>
										<td class="px-4 py-3 whitespace-nowrap text-sm">
											{#if canAdd}
												<form
													method="POST"
													action="{base}/groups/{data.group.id}?/addUser"
													use:enhance={() => {
														isSubmittingMembership = true;
														return async ({ update }) => {
															isSubmittingMembership = false;
															await update();
														};
													}}
													class="inline"
												>
													<input type="hidden" name="userId" value={user.id} />
													<button
														type="submit"
														disabled={isSubmittingMembership}
														class="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-xs font-medium"
													>
														{m.group_add_user()}
													</button>
												</form>
											{:else}
												<span class="px-3 py-1 bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 rounded text-xs">
													{m.group_detail_protected()}
												</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		{/if}

		<!-- Delete warning if group has members -->
		{#if data.canDeleteGroup && hasMembers}
			<div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
				<p class="text-yellow-800 dark:text-yellow-200 font-medium">
					{m.group_detail_cannot_delete_has_members()}
				</p>
				<p class="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
					{m.group_detail_cannot_delete_has_members_hint()}
				</p>
			</div>
		{/if}
	{:else}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
			<p class="text-gray-600 dark:text-gray-400">{m.group_detail_not_found()}</p>
		</div>
	{/if}
</div>
