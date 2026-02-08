<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import { base } from '$app/paths';
	import * as m from '$lib/paraglide/messages';

	export let data: PageData;

	let deletingId: number | null = null;

	function formatDate(dateString: string | null): string {
		if (!dateString) return m.common_never();
		const date = new Date(dateString);
		return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
	}

	function getStatus(lastUsedAt: string | null): { text: string; class: string } {
		if (!lastUsedAt) {
			return { text: m.totp_config_status_unused(), class: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' };
		}
		const lastUsed = new Date(lastUsedAt);
		const now = new Date();
		const daysSinceUse = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);

		if (daysSinceUse < 7) {
			return { text: m.totp_config_status_active(), class: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' };
		} else if (daysSinceUse < 30) {
			return { text: m.totp_config_status_recent(), class: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' };
		} else {
			return { text: m.totp_config_status_inactive(), class: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
		}
	}

	function confirmDelete(id: number, username: string) {
		if (confirm(m.totp_config_delete_confirm({ username }))) {
			deletingId = id;
			return true;
		}
		return false;
	}
</script>

<div class="space-y-6">
	{#if data.error}
		<div class="bg-red-50 border border-red-200 rounded-lg p-4">
			<p class="text-red-800 font-semibold">{m.common_error()}</p>
			<p class="text-red-600">{data.error}</p>
		</div>
	{/if}

	<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
		<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
			<h2 class="text-xl font-bold text-gray-900 dark:text-white">
				{m.totp_config_title()}
			</h2>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
				{#if data.dbInfo}
					{m.database_label({ info: data.dbInfo })}
				{:else}
					{m.totp_config_subtitle()}
				{/if}
			</p>
		</div>

		<div class="p-6">
			{#if data.configurations && data.configurations.length > 0}
				<!-- Table -->
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead class="bg-gray-50 dark:bg-gray-700">
							<tr>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.totp_config_table_username()}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.totp_config_table_issuer()}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.totp_config_table_algorithm()}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.totp_config_table_digits_period()}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.totp_config_table_created()}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.totp_config_table_last_used()}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.totp_config_table_status()}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.totp_config_table_actions()}
								</th>
							</tr>
						</thead>
						<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
							{#each data.configurations as config}
								{@const status = getStatus(config.last_used_at)}
								<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
										{config.username}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
										{config.issuer || 'Authelia'}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
										{config.algorithm}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
										{config.digits} digits / {config.period}s
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
										{formatDate(config.created_at)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
										{formatDate(config.last_used_at)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full {status.class}">
											{status.text}
										</span>
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-right">
										<form
											method="POST"
											action="{base}/totp/configurations?/delete"
											on:submit|preventDefault={(e) => {
												if (confirmDelete(config.id, config.username)) {
													e.currentTarget.submit();
												}
											}}
											use:enhance={() => {
												deletingId = config.id;
												return async ({ update }) => {
													deletingId = null;
													await update();
												};
											}}
											class="inline"
										>
											<input type="hidden" name="id" value={config.id} />
											<input type="hidden" name="username" value={config.username} />
											<button
												type="submit"
												disabled={deletingId === config.id}
												class="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
											>
												{deletingId === config.id ? m.totp_config_deleting() : m.totp_config_delete_button()}
											</button>
										</form>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else if !data.error}
				<div class="text-center py-8 text-gray-500 dark:text-gray-400">
					{m.totp_config_empty()}
				</div>
			{/if}
		</div>
	</div>
</div>
