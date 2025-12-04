<script lang="ts">
	import type { PageData } from './$types';
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
		<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
			<h2 class="text-xl font-bold text-gray-900 dark:text-white">
				Groups
			</h2>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
				Groups from directory
			</p>
		</div>

		<div class="p-6">
			{#if data.groups && data.groups.length > 0}
				<!-- Table -->
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead class="bg-gray-50 dark:bg-gray-700">
							<tr>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									Group Name
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									Members
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									Creation Date
								</th>
							</tr>
						</thead>
						<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
							{#each data.groups as group}
								<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
										{group.displayName}
									</td>
									<td class="px-6 py-4 text-sm text-gray-900 dark:text-white">
										{#if group.members && group.members.length > 0}
											<div class="space-y-1">
												<div class="font-medium">{group.members.length} member{group.members.length !== 1 ? 's' : ''}</div>
												<details class="cursor-pointer">
													<summary class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
														Show members
													</summary>
													<div class="mt-2 flex flex-wrap gap-1">
														{#each group.members as member}
															<span class="px-2 py-1 text-xs bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded">
																{member.id}
															</span>
														{/each}
													</div>
												</details>
											</div>
										{:else}
											<span class="text-gray-500">No members</span>
										{/if}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
										{formatDate(group.creationDate?.toISOString())}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="mt-4 text-sm text-gray-600 dark:text-gray-400">
					Total groups: {data.groups.length}
				</div>
			{:else if !data.error}
				<div class="text-center py-8 text-gray-500 dark:text-gray-400">
					No groups found in directory.
				</div>
			{/if}
		</div>
	</div>
</div>