<script lang="ts">
	import * as m from '$lib/paraglide/messages';
</script>

<div class="space-y-6">
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
		<h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">
			{m.dashboard_welcome_title()}
		</h2>
		<p class="text-gray-600 dark:text-gray-400">
			{m.dashboard_welcome_text()}
		</p>
	</div>

	<!-- Quick Stats -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{m.dashboard_totp_title()}</h3>
			<p class="text-gray-600 dark:text-gray-400">
				{m.dashboard_totp_text()}
			</p>
		</div>

		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{m.dashboard_banned_title()}</h3>
			<p class="text-gray-600 dark:text-gray-400">
				{m.dashboard_banned_text()}
			</p>
		</div>

		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">{m.dashboard_notifications_title()}</h3>
			<p class="text-gray-600 dark:text-gray-400">
				{m.dashboard_notifications_text()}
			</p>
		</div>
	</div>
</div>
