<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import { base } from '$app/paths';
	import * as m from '$lib/paraglide/messages';

	export let data: PageData;

	let deletingId: number | null = null;
	let showAddForm = false;
	let isSubmitting = false;

	function formatDate(dateString: string | null): string {
		if (!dateString) return m.common_never();
		const date = new Date(dateString);
		return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
	}

	interface BanRecord {
		id: number;
		username: string;
		time: string | null;
		expires: string | null;
		source: string;
		reason: string | null;
		revoked: boolean;
		expired: boolean;
	}

	function getStatus(ban: BanRecord): { text: string; class: string } {
		// Check if manually revoked
		if (ban.revoked) {
			return { text: m.status_revoked(), class: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' };
		}

		// Check if expired
		if (ban.expired) {
			return { text: m.status_expired(), class: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' };
		}

		// Check if has expiration date
		if (ban.expires) {
			const expiresDate = new Date(ban.expires);
			const now = new Date();
			if (expiresDate <= now) {
				return { text: m.status_expired(), class: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' };
			}
			return { text: m.status_active(), class: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
		}

		// Permanent ban
		return { text: m.status_permanent(), class: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
	}

	function confirmDelete(id: number, username: string) {
		if (confirm(m.banned_users_delete_confirm({ username }))) {
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
				{m.banned_users_title()}
			</h2>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
				{m.banned_users_subtitle()}
			</p>
		</div>

		<div class="p-6">
			<!-- Add Ban Button -->
			<div class="mb-6">
				<button
					on:click={() => showAddForm = !showAddForm}
					class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
				>
					{showAddForm ? m.common_cancel() : m.banned_users_ban_button()}
				</button>
			</div>

			<!-- Add Ban Form -->
			{#if showAddForm}
				<div class="mb-6 p-6 bg-gray-50 dark:bg-gray-900 rounded-lg">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">{m.banned_users_add_title()}</h3>
					<form
						method="POST"
						action="{base}/banned/users?/create"
						use:enhance={() => {
							isSubmitting = true;
							return async ({ update }) => {
								isSubmitting = false;
								showAddForm = false;
								await update();
							};
						}}
						class="space-y-4"
					>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<label for="username" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									{m.banned_users_username_label()} <span class="text-red-500">{m.common_required()}</span>
								</label>
								<input
									id="username"
									name="username"
									type="text"
									required
									class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder={m.banned_users_username_placeholder()}
								/>
							</div>

							<div>
								<label for="source" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									{m.banned_users_source_label()}
								</label>
								<select
									id="source"
									name="source"
									class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="admin">{m.banned_users_source_admin()}</option>
									<option value="system">{m.banned_users_source_system()}</option>
									<option value="security">{m.banned_users_source_security()}</option>
									<option value="manual">{m.banned_users_source_manual()}</option>
								</select>
							</div>

							<div>
								<label for="expires" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									{m.banned_users_expires_label()}
								</label>
								<input
									id="expires"
									name="expires"
									type="datetime-local"
									class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>

							<div>
								<div class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									&nbsp;
								</div>
								<label class="flex items-center">
									<input
										name="permanent"
										type="checkbox"
										value="true"
										class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:bg-gray-700 dark:border-gray-600"
										on:change={(e) => {
											const expiresInput = document.getElementById('expires');
											if (expiresInput) {
												expiresInput.disabled = e.currentTarget.checked;
											}
										}}
									/>
									<span class="ml-2 text-sm text-gray-700 dark:text-gray-300">{m.banned_users_permanent_label()}</span>
								</label>
							</div>

							<div class="md:col-span-2">
								<label for="reason" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									{m.banned_users_reason_label()}
								</label>
								<textarea
									id="reason"
									name="reason"
									rows="2"
									class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder={m.banned_users_reason_placeholder()}
								></textarea>
							</div>
						</div>

						<div class="flex gap-2">
							<button
								type="submit"
								disabled={isSubmitting}
								class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
							>
								{isSubmitting ? m.banned_users_creating() : m.banned_users_ban_button()}
							</button>
							<button
								type="button"
								on:click={() => showAddForm = false}
								class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
							>
								{m.common_cancel()}
							</button>
						</div>
					</form>
				</div>
			{/if}

			{#if data.bannedUsers && data.bannedUsers.length > 0}
				<!-- Table -->
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead class="bg-gray-50 dark:bg-gray-700">
							<tr>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.banned_users_table_username()}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.banned_users_table_ban_time()}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.banned_users_table_expires()}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.banned_users_table_source()}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.banned_users_table_reason()}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.banned_users_table_status()}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.banned_users_table_actions()}
								</th>
							</tr>
						</thead>
						<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
							{#each data.bannedUsers as ban}
								{@const status = getStatus(ban)}
								<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
										{ban.username}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
										{formatDate(ban.time)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
										{ban.expires ? formatDate(ban.expires) : m.common_never()}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
										{ban.source}
									</td>
									<td class="px-6 py-4 text-sm text-gray-900 dark:text-white">
										{ban.reason || '-'}
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full {status.class}">
											{status.text}
										</span>
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-right">
										<form
											method="POST"
											action="{base}/banned/users?/delete"
											use:enhance={() => {
												if (!confirmDelete(ban.id, ban.username)) {
													return ({ cancel }) => cancel();
												}
												deletingId = ban.id;
												return async ({ update }) => {
													deletingId = null;
													await update();
												};
											}}
											class="inline"
										>
											<input type="hidden" name="id" value={ban.id} />
											<input type="hidden" name="username" value={ban.username} />
											<button
												type="submit"
												disabled={deletingId === ban.id}
												class="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
											>
												{deletingId === ban.id ? m.common_deleting() : m.common_delete()}
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
					{m.banned_users_empty()}
				</div>
			{/if}
		</div>
	</div>
</div>
