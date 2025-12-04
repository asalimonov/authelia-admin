<script lang="ts">
	import { locales, getLocale } from '$lib/paraglide/runtime';
	import * as m from '$lib/paraglide/messages';

	const languageNames: Record<string, () => string> = {
		en: m.lang_en,
		ru: m.lang_ru
	};

	function getLanguageName(locale: string): string {
		const fn = languageNames[locale];
		return fn ? fn() : locale;
	}
</script>

<div class="relative inline-block">
	<select
		class="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded border border-gray-300 dark:border-gray-600 text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
		value={getLocale()}
		on:change={(e) => {
			const newLocale = e.currentTarget.value;
			// Store in cookie for persistence
			document.cookie = `PARAGLIDE_LOCALE=${newLocale};path=/;max-age=31536000`;
			// Store in localStorage as backup
			localStorage.setItem('lang.current', newLocale);
			// Reload the current page - server will read the cookie and apply locale
			window.location.reload();
		}}
	>
		{#each locales as locale}
			<option value={locale}>{getLanguageName(locale)}</option>
		{/each}
	</select>
</div>
