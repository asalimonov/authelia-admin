<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';

	const errorMessages: Record<number, string> = {
		400: 'Bad Request',
		401: 'Unauthorized',
		403: 'Forbidden',
		404: 'Not Found',
		405: 'Method Not Allowed',
		408: 'Request Timeout',
		429: 'Too Many Requests',
		500: 'Internal Server Error',
		501: 'Not Implemented',
		502: 'Bad Gateway',
		503: 'Service Unavailable',
		504: 'Gateway Timeout'
	};

	$: status = $page.status;
	$: message = $page.error?.message || errorMessages[status] || 'An error occurred';
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
				Authelia
			</a>
			<a
				href="{base}/"
				class="text-blue-600 dark:text-blue-400 hover:underline"
			>
				Authelia Admin Panel
			</a>
		</nav>
	</div>
</main>