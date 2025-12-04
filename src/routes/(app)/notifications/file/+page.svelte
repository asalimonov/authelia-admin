<script lang="ts">
	import type { PageData } from './$types';
	import * as m from '$lib/paraglide/messages';

	export let data: PageData;
</script>

<div class="space-y-6">
	{#if data.error}
		<div class="bg-red-50 border border-red-200 rounded-lg p-4">
			<p class="text-red-800 font-semibold">{m.common_error()}</p>
			<p class="text-red-600">{data.error}</p>
		</div>
	{:else if !data.hasNotifier}
		<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
			<p class="text-yellow-800 font-semibold">{m.notifications_file_not_configured_title()}</p>
			<p class="text-yellow-600">{m.notifications_file_not_configured_text()}</p>
		</div>
	{:else}
		<!-- Notification File Info -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-xl font-bold text-gray-900 dark:text-white">
					{m.notifications_file_title()}
				</h2>
				<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
					{m.notifications_file_reading_from({ filename: data.filename || m.notifications_file_not_configured_path() })}
				</p>
			</div>

			<div class="p-6">
				<div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-x-auto">
					<pre class="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">{data.notifications || m.notifications_file_no_notifications()}</pre>
				</div>
			</div>
		</div>
	{/if}
</div>
