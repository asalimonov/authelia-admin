<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import { base } from '$app/paths';
	
	export let data: PageData;
	
	let deletingId: number | null = null;
	let showAddForm = false;
	let isSubmitting = false;
	
	function formatDate(dateString: string | null): string {
		if (!dateString) return 'Never';
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
			return { text: 'Revoked', class: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' };
		}
		
		// Check if expired
		if (ban.expired) {
			return { text: 'Expired', class: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' };
		}
		
		// Check if has expiration date
		if (ban.expires) {
			const expiresDate = new Date(ban.expires);
			const now = new Date();
			if (expiresDate <= now) {
				return { text: 'Expired', class: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' };
			}
			return { text: 'Active', class: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
		}
		
		// Permanent ban
		return { text: 'Permanent', class: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
	}
	
	function confirmDelete(id: number, username: string) {
		if (confirm(`Are you sure you want to delete the ban for user "${username}"?`)) {
			deletingId = id;
			return true;
		}
		return false;
	}
</script>

<div class="space-y-6">
	{#if data.error}
		<div class="bg-red-50 border border-red-200 rounded-lg p-4">
			<p class="text-red-800 font-semibold">Error</p>
			<p class="text-red-600">{data.error}</p>
		</div>
	{/if}
	
	{#if data.storageType && data.storageType !== 'sqlite'}
		<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
			<p class="text-yellow-800 font-semibold">Storage Type Not Supported</p>
			<p class="text-yellow-600">Current storage type: {data.storageType}. Only SQLite is currently supported.</p>
		</div>
	{/if}
	
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
		<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
			<h2 class="text-xl font-bold text-gray-900 dark:text-white">
				Banned Users
			</h2>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
				{#if data.dbPath}
					Database: {data.dbPath}
				{:else}
					Manage banned user accounts
				{/if}
			</p>
		</div>
		
		<div class="p-6">
			<!-- Add Ban Button -->
			<div class="mb-6">
				<button
					on:click={() => showAddForm = !showAddForm}
					class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
				>
					{showAddForm ? 'Cancel' : 'Ban User'}
				</button>
			</div>
			
			<!-- Add Ban Form -->
			{#if showAddForm}
				<div class="mb-6 p-6 bg-gray-50 dark:bg-gray-900 rounded-lg">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Ban New User</h3>
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
									Username <span class="text-red-500">*</span>
								</label>
								<input
									id="username"
									name="username"
									type="text"
									required
									class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Enter username"
								/>
							</div>
							
							<div>
								<label for="source" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Source
								</label>
								<select
									id="source"
									name="source"
									class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								>
									<option value="admin">Admin</option>
									<option value="system">System</option>
									<option value="security">Security</option>
									<option value="manual">Manual</option>
								</select>
							</div>
							
							<div>
								<label for="expires" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Expires
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
									<span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Permanent Ban</span>
								</label>
							</div>
							
							<div class="md:col-span-2">
								<label for="reason" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
									Reason
								</label>
								<textarea
									id="reason"
									name="reason"
									rows="2"
									class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
									placeholder="Enter reason for ban (optional)"
								></textarea>
							</div>
						</div>
						
						<div class="flex gap-2">
							<button
								type="submit"
								disabled={isSubmitting}
								class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
							>
								{isSubmitting ? 'Creating...' : 'Ban User'}
							</button>
							<button
								type="button"
								on:click={() => showAddForm = false}
								class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
							>
								Cancel
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
									Username
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									Ban Time
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									Expires
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									Source
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									Reason
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									Status
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									Actions
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
										{ban.expires ? formatDate(ban.expires) : 'Never'}
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
												{deletingId === ban.id ? 'Deleting...' : 'Delete'}
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
					No banned users found in the database.
				</div>
			{/if}
		</div>
	</div>
</div>