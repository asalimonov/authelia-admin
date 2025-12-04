<script lang="ts">
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages';

	export let data: PageData;

	let searchTerm = '';
	let selectedUser = '';

	function formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
	}

	// Get unique users for filter dropdown
	$: uniqueUsers = data.history ? [...new Set(data.history.map(h => h.username))].sort() : [];

	// Filter history based on search and selected user
	$: filteredHistory = data.history?.filter(entry => {
		const matchesSearch = searchTerm === '' ||
			entry.username.toLowerCase().includes(searchTerm.toLowerCase());
		const matchesUser = selectedUser === '' || entry.username === selectedUser;
		return matchesSearch && matchesUser;
	}) || [];
</script>

<div class="space-y-6">
	{#if data.error}
		<div class="bg-red-50 border border-red-200 rounded-lg p-4">
			<p class="text-red-800 font-semibold">{m.common_error()}</p>
			<p class="text-red-600">{data.error}</p>
		</div>
	{/if}

	{#if data.storageType && data.storageType !== 'sqlite'}
		<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
			<p class="text-yellow-800 font-semibold">{m.storage_not_supported_title()}</p>
			<p class="text-yellow-600">{m.storage_not_supported_text({ type: data.storageType })}</p>
		</div>
	{/if}

	<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
		<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
			<h2 class="text-xl font-bold text-gray-900 dark:text-white">
				{m.totp_history_title()}
			</h2>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
				{#if data.dbPath}
					{m.database_label({ path: data.dbPath })} | {m.totp_history_showing_entries({ limit: data.limit })}
				{:else}
					{m.totp_history_subtitle()}
				{/if}
			</p>
		</div>

		<div class="p-6">
			{#if data.history && data.history.length > 0}
				<!-- Filters -->
				<div class="mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
					<input
						type="text"
						placeholder={m.totp_history_search_placeholder()}
						bind:value={searchTerm}
						class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
					<select
						bind:value={selectedUser}
						class="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
					>
						<option value="">{m.totp_history_filter_all_users()}</option>
						{#each uniqueUsers as user}
							<option value={user}>{user}</option>
						{/each}
					</select>
					<div class="text-sm text-gray-600 dark:text-gray-400 flex items-center">
						{m.totp_history_showing({ filtered: filteredHistory.length, total: data.history.length })}
					</div>
				</div>

				<!-- History Table -->
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead class="bg-gray-50 dark:bg-gray-700">
							<tr>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.totp_history_table_id()}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.totp_history_table_timestamp()}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.totp_history_table_username()}
								</th>
							</tr>
						</thead>
						<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
							{#each filteredHistory as entry}
								<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
										{entry.id}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
										{formatDate(entry.created_at)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
										{entry.username}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else if !data.error}
				<div class="text-center py-8 text-gray-500 dark:text-gray-400">
					{m.totp_history_empty()}
				</div>
			{/if}

			{#if data.history && data.history.length === data.limit}
				<div class="mt-4 text-center">
					<p class="text-sm text-gray-600 dark:text-gray-400">
						{m.totp_history_max_entries({ limit: data.limit })}
					</p>
				</div>
			{/if}
		</div>
	</div>
</div>
