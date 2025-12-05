<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { base } from '$app/paths';
	import * as m from '$lib/paraglide/messages';

	export let data: PageData;
	export let form: ActionData;

	// Form fields - initialize with current values
	let displayName = data.group?.displayName || '';

	// UI state
	let isSubmitting = false;
</script>

<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<h1 class="text-2xl font-bold text-gray-900 dark:text-white">{m.group_edit_title()}</h1>
		<a
			href="{base}/groups/{data.group?.id}"
			class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors inline-block text-center"
		>
			{m.group_edit_back()}
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

	{#if data.group}
		<!-- Group Details Form -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-xl font-bold text-gray-900 dark:text-white">{m.group_edit_section_title()}</h2>
				<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
					{m.group_edit_section_subtitle()}
				</p>
			</div>

			<div class="p-6">
				<form
					method="POST"
					action="{base}/groups/{data.group.id}/edit?/update"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ update }) => {
							isSubmitting = false;
							await update();
						};
					}}
					class="space-y-6"
				>
					<!-- Display Name -->
					<div>
						<label
							for="displayName"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
						>
							{m.group_edit_displayname_label()} <span class="text-red-500">{m.common_required()}</span>
						</label>
						<input
							id="displayName"
							name="displayName"
							type="text"
							required
							bind:value={displayName}
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder={m.group_edit_displayname_placeholder()}
						/>
					</div>

					<!-- Action Buttons -->
					<div class="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
						<button
							type="submit"
							disabled={isSubmitting || !displayName.trim()}
							class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
						>
							{isSubmitting ? m.group_edit_button_saving() : m.group_edit_button_save()}
						</button>
						<a
							href="{base}/groups/{data.group.id}"
							class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-center font-medium"
						>
							{m.group_edit_button_cancel()}
						</a>
					</div>
				</form>
			</div>
		</div>
	{:else}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
			<p class="text-gray-600 dark:text-gray-400">
				{m.group_edit_no_permission()}
			</p>
		</div>
	{/if}
</div>
