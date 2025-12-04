<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import * as m from '$lib/paraglide/messages';

	// Map status codes to translation keys
	const errorKeys: Record<number, () => string> = {
		400: m.error_400,
		401: m.error_401,
		403: m.error_403,
		404: m.error_404,
		405: m.error_405,
		408: m.error_408,
		429: m.error_429,
		500: m.error_500,
		501: m.error_501,
		502: m.error_502,
		503: m.error_503,
		504: m.error_504
	};

	$: status = $page.status;
	$: message = $page.error?.message || (errorKeys[status] ? errorKeys[status]() : m.error_generic());
	$: isServerError = status >= 500;
</script>

<main class="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-8">
	<div class="text-center">
		<h1
			class="text-8xl font-bold mb-4 {isServerError ? 'text-red-600 dark:text-red-500' : 'text-gray-800 dark:text-gray-200'}"
		>
			{status}
		</h1>

		<p class="text-xl text-gray-600 dark:text-gray-400 mb-10">
			{message}
		</p>

		<nav class="flex justify-center gap-8">
			<a
				href="/"
				class="text-blue-600 dark:text-blue-400 hover:underline"
			>
				{m.error_link_authelia()}
			</a>
			<a
				href="{base}/"
				class="text-blue-600 dark:text-blue-400 hover:underline"
			>
				{m.error_link_admin()}
			</a>
		</nav>
	</div>
</main>
