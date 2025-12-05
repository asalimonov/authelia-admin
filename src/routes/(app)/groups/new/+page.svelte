<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { base } from '$app/paths';
	import * as m from '$lib/paraglide/messages';

	export let data: PageData;
	export let form: ActionData;

	// Form fields
	let displayName = form?.values?.displayName || '';

	// UI state
	let isSubmitting = false;

	// Clear form on successful "create and new"
	$: if (form?.success && form?.clearForm) {
		displayName = '';
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<h1 class="text-2xl font-bold text-gray-900 dark:text-white">{m.group_new_title()}</h1>
		<a
			href="{base}/groups"
			class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors inline-block text-center"
		>
			{m.group_new_back()}
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

	{#if data.canCreate}
		<!-- Group Details Form -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-xl font-bold text-gray-900 dark:text-white">{m.group_new_section_title()}</h2>
				<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
					{m.group_new_section_subtitle()}
				</p>
			</div>

			<div class="p-6">
				<form
					method="POST"
					action="{base}/groups/new?/create"
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
							{m.group_new_displayname_label()} <span class="text-red-500">{m.common_required()}</span>
						</label>
						<input
							id="displayName"
							name="displayName"
							type="text"
							required
							bind:value={displayName}
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder={m.group_new_displayname_placeholder()}
						/>
						<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
							{m.group_new_displayname_hint()}
						</p>
					</div>

					<!-- Action Buttons -->
					<div class="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
						<button
							type="submit"
							name="action"
							value="create"
							disabled={isSubmitting || !displayName.trim()}
							class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
						>
							{isSubmitting ? m.group_new_button_creating() : m.group_new_button_create()}
						</button>
						<button
							type="submit"
							name="action"
							value="createAndNew"
							disabled={isSubmitting || !displayName.trim()}
							class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
						>
							{m.group_new_button_create_another()}
						</button>
						<a
							href="{base}/groups"
							class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-center font-medium"
						>
							{m.group_new_button_cancel()}
						</a>
					</div>

					<!-- Help Text -->
					<div class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
						<p class="text-sm text-blue-700 dark:text-blue-300">
							<strong>{m.group_new_button_create()}</strong> {m.group_new_help_create()}
						</p>
						<p class="text-sm text-blue-700 dark:text-blue-300 mt-1">
							<strong>{m.group_new_button_create_another()}</strong> {m.group_new_help_create_another()}
						</p>
					</div>
				</form>
			</div>
		</div>
	{:else}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
			<p class="text-gray-600 dark:text-gray-400">
				{m.group_new_no_permission()}
			</p>
		</div>
	{/if}
</div>
