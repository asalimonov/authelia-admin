<script lang="ts">
	import type { PageData } from './$types';
	import { base } from '$app/paths';
	import { formatDate } from '$lib/utils/validation';
	import * as m from '$lib/paraglide/messages';

	export let data: PageData;
</script>

<div class="space-y-6">
	{#if data.error}
		<div class="bg-red-50 border border-red-200 rounded-lg p-4">
			<p class="text-red-800 font-semibold">{m.common_error()}</p>
			<p class="text-red-600">{data.error}</p>
		</div>
	{/if}

	<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
		<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
			<div>
				<h2 class="text-xl font-bold text-gray-900 dark:text-white">
					{m.groups_title()}
				</h2>
				<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
					{m.groups_subtitle()}
				</p>
			</div>
			{#if data.canCreateGroup}
				<a
					href="{base}/groups/new"
					class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors inline-block text-center font-medium whitespace-nowrap"
				>
					{m.group_add_button()}
				</a>
			{/if}
		</div>

		<div class="p-6">
			{#if data.groups && data.groups.length > 0}
				<!-- Table -->
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead class="bg-gray-50 dark:bg-gray-700">
							<tr>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.groups_table_name()}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.groups_table_members()}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.groups_table_creation_date()}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									
								</th>
							</tr>
						</thead>
						<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
							{#each data.groups as group}
								<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
									<td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
										<a href="{base}/groups/{group.id}" class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
											{group.displayName}
										</a>
									</td>
									<td class="px-6 py-4 text-sm text-gray-900 dark:text-white">
										{#if group.members && group.members.length > 0}
											<div class="space-y-1">
												<div class="font-medium">
													{group.members.length === 1
														? m.groups_member_count({ count: group.members.length })
														: m.groups_member_count_plural({ count: group.members.length })}
												</div>
												<details class="cursor-pointer">
													<summary class="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
														{m.groups_show_members()}
													</summary>
													<div class="mt-2 flex flex-wrap gap-1">
														{#each group.members as member}
															<a
																href="{base}/users/{member.id}"
																class="px-2 py-1 text-xs bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded hover:bg-blue-100 hover:text-blue-800 dark:hover:bg-blue-900 dark:hover:text-blue-200 transition-colors"
															>
																{member.id}
															</a>
														{/each}
													</div>
												</details>
											</div>
										{:else}
											<span class="text-gray-500">{m.groups_no_members()}</span>
										{/if}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
										{formatDate(group.creationDate?.toISOString())}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm">
										<a
											href="{base}/groups/{group.id}"
											class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors inline-block"
										>
											{m.groups_details_button()}
										</a>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="mt-4 text-sm text-gray-600 dark:text-gray-400">
					{m.groups_total({ count: data.groups.length })}
				</div>
			{:else if !data.error}
				<div class="text-center py-8 text-gray-500 dark:text-gray-400">
					{m.groups_empty()}
				</div>
			{/if}
		</div>
	</div>
</div>
