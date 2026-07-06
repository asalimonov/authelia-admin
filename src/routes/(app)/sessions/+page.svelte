<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import { base } from '$app/paths';
	import * as m from '$lib/paraglide/messages';

	export let data: PageData;

	let revokingId: string | null = null;
	let revokingUser: string | null = null;

	// Anonymous sessions (no logged-in user) are just browser/scanner noise;
	// hide them by default so the list shows real users.
	let hideAnonymous = true;

	function formatUnix(seconds: number): string {
		if (!seconds) return m.common_never();
		const date = new Date(seconds * 1000);
		return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
	}

	function formatTTL(seconds: number): string {
		if (seconds < 0) return m.common_never();
		if (seconds < 3600) return m.sessions_expires_minutes({ minutes: Math.ceil(seconds / 60) });
		if (seconds < 86400) return m.sessions_expires_hours({ hours: Math.round(seconds / 3600) });
		return m.sessions_expires_days({ days: Math.round(seconds / 86400) });
	}

	function confirmRevoke(username: string): boolean {
		return confirm(m.sessions_revoke_confirm({ username: username || m.sessions_anonymous() }));
	}

	function confirmRevokeUser(username: string): boolean {
		return confirm(m.sessions_revoke_user_confirm({ username }));
	}

	// Distinct authenticated usernames for the "revoke all" actions
	$: usernames = [...new Set(data.sessions.filter((s) => s.username).map((s) => s.username))];

	$: anonymousCount = data.sessions.filter((s) => !s.username).length;
	$: visibleSessions = hideAnonymous
		? data.sessions.filter((s) => s.username)
		: data.sessions;
</script>

<div class="space-y-6">
	{#if data.error}
		<div class="bg-red-50 border border-red-200 rounded-lg p-4">
			<p class="text-red-800 font-semibold">{m.common_error()}</p>
			<p class="text-red-600">{data.error}</p>
		</div>
	{/if}

	<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
		<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
			<h2 class="text-xl font-bold text-gray-900 dark:text-white">
				{m.sessions_title()}
			</h2>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
				{m.sessions_subtitle()}
			</p>
		</div>

		<div class="p-6">
			{#if !data.enabled}
				<div class="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
					<p class="text-yellow-800 dark:text-yellow-200">{m.sessions_not_configured()}</p>
				</div>
			{:else if data.sessions.length === 0}
				<p class="text-gray-600 dark:text-gray-400">{m.sessions_empty()}</p>
			{:else}
				{#if anonymousCount > 0}
					<label class="mb-4 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
						<input
							type="checkbox"
							bind:checked={hideAnonymous}
							class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
						/>
						{m.sessions_hide_anonymous({ count: anonymousCount })}
					</label>
				{/if}

				{#if visibleSessions.length === 0}
					<p class="text-gray-600 dark:text-gray-400">{m.sessions_only_anonymous()}</p>
				{:else}
				{#if usernames.length > 0}
					<div class="mb-6 flex flex-wrap gap-2">
						{#each usernames as username}
							<form
								method="POST"
								action="{base}/sessions?/revokeUser"
								use:enhance={() => {
									revokingUser = username;
									return async ({ update }) => {
										revokingUser = null;
										await update();
									};
								}}
								on:submit={(e) => {
									if (!confirmRevokeUser(username)) e.preventDefault();
								}}
							>
								<input type="hidden" name="username" value={username} />
								<button
									type="submit"
									disabled={revokingUser === username}
									class="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
								>
									{revokingUser === username
										? m.sessions_revoking()
										: m.sessions_revoke_user_button({ username })}
								</button>
							</form>
						{/each}
					</div>
				{/if}

				<div class="overflow-x-auto">
					<table class="w-full">
						<thead class="bg-gray-50 dark:bg-gray-700">
							<tr>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.sessions_table_user()}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.sessions_table_last_activity()}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.sessions_table_signed_in()}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.sessions_table_expires()}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.sessions_table_remember_me()}
								</th>
								<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
									{m.sessions_table_actions()}
								</th>
							</tr>
						</thead>
						<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
							{#each visibleSessions as session (session.id)}
								<tr class="hover:bg-gray-50 dark:hover:bg-gray-700">
									<td class="px-6 py-4 whitespace-nowrap">
										{#if session.username}
											<span class="text-sm font-medium text-gray-900 dark:text-white">{session.username}</span>
											{#if session.displayName && session.displayName !== session.username}
												<span class="text-sm text-gray-500 dark:text-gray-400">({session.displayName})</span>
											{/if}
										{:else}
											<span class="text-sm italic text-gray-500 dark:text-gray-400">{m.sessions_anonymous()}</span>
										{/if}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
										{formatUnix(session.lastActivity)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
										{formatUnix(session.firstFactorAuthnTimestamp)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
										{formatTTL(session.expiresInSeconds)}
									</td>
									<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
										{session.keepMeLoggedIn ? m.common_yes() : m.common_no()}
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										<form
											method="POST"
											action="{base}/sessions?/revoke"
											class="inline"
											use:enhance={() => {
												revokingId = session.id;
												return async ({ update }) => {
													revokingId = null;
													await update();
												};
											}}
											on:submit={(e) => {
												if (!confirmRevoke(session.username)) e.preventDefault();
											}}
										>
											<input type="hidden" name="id" value={session.id} />
											<button
												type="submit"
												disabled={revokingId === session.id}
												class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-sm font-medium disabled:text-gray-400 disabled:cursor-not-allowed"
											>
												{revokingId === session.id ? m.sessions_revoking() : m.sessions_revoke_button()}
											</button>
										</form>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				{/if}
			{/if}
		</div>
	</div>
</div>
