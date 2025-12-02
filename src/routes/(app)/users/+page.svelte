<script lang="ts">
	import type { PageData } from './$types';
	import { base } from '$app/paths';
	import { formatDate } from '$lib/utils/validation';

	export let data: PageData;
</script>

<div class="space-y-6">
	{#if data.error}
		<div class="bg-red-50 border border-red-200 rounded-lg p-4">
			<p class="text-red-800 font-semibold">Error</p>
			<p class="text-red-600">{data.error}</p>
		</div>
	{/if}
	
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
		<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
			<div>
				<h2 class="text-xl font-bold text-gray-900 dark:text-white">
					LDAP Users
				</h2>
				<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
					{#if data.ldapServer}
						Server: {data.ldapServer}
					{:else}
						User directory from LDAP server
					{/if}
				</p>
			</div>
			{#if data.canCreateUsers}
				<a
					href="{base}/users/new"
					class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
				>
					<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
					</svg>
					Add User
				</a>
			{/if}
		</div>
		
		<div class="p-6">
			{#if data.users && data.users.length > 0}
				<!-- Table -->
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead class="bg-gray-50 dark:bg-gray-700">
							<tr>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									User ID
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									Display Name
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									Email
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									First Name
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									Last Name
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									Creation Date
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									
								</th>
							</tr>
						</thead>
						<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
							{#each data.users as user}
								<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
										{user.uid}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
										{user.displayName || '-'}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
										{#if user.mail}
											<a href="mailto:{user.mail}" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
												{user.mail}
											</a>
										{:else}
											-
										{/if}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
										{user.givenName || '-'}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
										{user.sn || '-'}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
										{formatDate(user.createTimestamp)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm">
										<a
											href="{base}/users/{user.uid}"
											class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors inline-block"
										>
											Details
										</a>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				
				<div class="mt-4 text-sm text-gray-600 dark:text-gray-400">
					Total users: {data.users.length}
				</div>
			{:else if !data.error}
				<div class="text-center py-8 text-gray-500 dark:text-gray-400">
					No users found in LDAP directory.
				</div>
			{/if}
		</div>
	</div>
</div>