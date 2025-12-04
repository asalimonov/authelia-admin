<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { base } from '$app/paths';
	import * as m from '$lib/paraglide/messages';

	export let data: PageData;
	export let form: ActionData;

	// Form fields
	let userId = form?.values?.userId || '';
	let email = form?.values?.email || '';
	let displayName = form?.values?.displayName || '';
	let firstName = form?.values?.firstName || '';
	let lastName = form?.values?.lastName || '';
	let password = '';
	let confirmPassword = '';

	// UI state
	let isSubmitting = false;
	let clientErrors: string[] = [];

	// Clear form on success when using "Create +1"
	$: if (form?.success && form?.clearForm) {
		userId = '';
		email = '';
		displayName = '';
		firstName = '';
		lastName = '';
		password = '';
		confirmPassword = '';
	}

	function validateForm(): boolean {
		clientErrors = [];

		if (!userId.trim()) {
			clientErrors.push(m.validation_userid_required());
		} else if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(userId.trim())) {
			clientErrors.push(m.validation_userid_format());
		}

		if (!email.trim()) {
			clientErrors.push(m.validation_email_required());
		} else if (
			!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(
				email.trim()
			)
		) {
			clientErrors.push(m.validation_email_format());
		}

		if (!displayName.trim()) {
			clientErrors.push(m.validation_displayname_required());
		}

		if (!password) {
			clientErrors.push(m.validation_password_required());
		} else {
			if (password.length < 8) {
				clientErrors.push(m.validation_password_min_length());
			}
			if (password.length > 64) {
				clientErrors.push(m.validation_password_max_length());
			}
			if (!/[a-z]/.test(password)) {
				clientErrors.push(m.validation_password_lowercase());
			}
			if (!/[A-Z]/.test(password)) {
				clientErrors.push(m.validation_password_uppercase());
			}
			if (!/[0-9]/.test(password)) {
				clientErrors.push(m.validation_password_number());
			}
		}

		if (password !== confirmPassword) {
			clientErrors.push(m.validation_password_mismatch());
		}

		return clientErrors.length === 0;
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<h1 class="text-2xl font-bold text-gray-900 dark:text-white">{m.user_new_title()}</h1>
		<a
			href="{base}/users"
			class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors inline-block text-center"
		>
			{m.user_new_back()}
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

	{#if clientErrors.length > 0}
		<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
			<p class="text-red-800 dark:text-red-200 font-semibold">{m.common_validation_error()}</p>
			<ul class="list-disc list-inside text-red-600 dark:text-red-300">
				{#each clientErrors as error}
					<li>{error}</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if form?.success}
		<div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
			<p class="text-green-800 dark:text-green-200 font-semibold">{m.common_success()}</p>
			<p class="text-green-600 dark:text-green-300">{form.message}</p>
		</div>
	{/if}

	{#if data.canCreate}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
				<h2 class="text-xl font-bold text-gray-900 dark:text-white">{m.user_new_section_title()}</h2>
				<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
					{m.user_new_section_subtitle()}
				</p>
			</div>

			<div class="p-6">
				<form
					method="POST"
					action="{base}/users/new?/create"
					use:enhance={() => {
						if (!validateForm()) {
							return ({ cancel }) => cancel();
						}
						isSubmitting = true;
						return async ({ update }) => {
							isSubmitting = false;
							await update();
						};
					}}
					class="space-y-6"
				>
					<!-- User ID and Email -->
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label
								for="userId"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>
								{m.user_new_userid_label()} <span class="text-red-500">{m.common_required()}</span>
							</label>
							<input
								id="userId"
								name="userId"
								type="text"
								required
								bind:value={userId}
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder={m.user_new_userid_placeholder()}
							/>
							<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
								{m.user_new_userid_hint()}
							</p>
						</div>

						<div>
							<label
								for="email"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>
								{m.user_new_email_label()} <span class="text-red-500">{m.common_required()}</span>
							</label>
							<input
								id="email"
								name="email"
								type="email"
								required
								bind:value={email}
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder={m.user_new_email_placeholder()}
							/>
						</div>
					</div>

					<!-- Display Name -->
					<div>
						<label
							for="displayName"
							class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
						>
							{m.user_new_displayname_label()} <span class="text-red-500">{m.common_required()}</span>
						</label>
						<input
							id="displayName"
							name="displayName"
							type="text"
							required
							bind:value={displayName}
							class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder={m.user_new_displayname_placeholder()}
						/>
					</div>

					<!-- First Name and Last Name -->
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label
								for="firstName"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>
								{m.user_new_firstname_label()}
							</label>
							<input
								id="firstName"
								name="firstName"
								type="text"
								bind:value={firstName}
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder={m.user_new_firstname_placeholder()}
							/>
						</div>

						<div>
							<label
								for="lastName"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>
								{m.user_new_lastname_label()}
							</label>
							<input
								id="lastName"
								name="lastName"
								type="text"
								bind:value={lastName}
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder={m.user_new_lastname_placeholder()}
							/>
						</div>
					</div>

					<!-- Password Fields -->
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<label
								for="password"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>
								{m.user_new_password_label()} <span class="text-red-500">{m.common_required()}</span>
							</label>
							<input
								id="password"
								name="password"
								type="password"
								required
								bind:value={password}
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder={m.user_new_password_placeholder()}
							/>
						</div>

						<div>
							<label
								for="confirmPassword"
								class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
							>
								{m.user_new_confirm_password_label()} <span class="text-red-500">{m.common_required()}</span>
							</label>
							<input
								id="confirmPassword"
								name="confirmPassword"
								type="password"
								required
								bind:value={confirmPassword}
								class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
								placeholder={m.user_new_confirm_password_placeholder()}
							/>
						</div>
					</div>

					<!-- Password Requirements -->
					<div class="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
						<p class="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">{m.user_new_password_requirements_title()}</p>
						<ul class="text-sm text-blue-700 dark:text-blue-300 list-disc list-inside space-y-1">
							<li>{m.user_new_password_req_length()}</li>
							<li>{m.user_new_password_req_lowercase()}</li>
							<li>{m.user_new_password_req_uppercase()}</li>
							<li>{m.user_new_password_req_number()}</li>
						</ul>
					</div>

					<!-- Action Buttons -->
					<div class="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
						<button
							type="submit"
							name="action"
							value="create"
							disabled={isSubmitting}
							class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
						>
							{isSubmitting ? m.user_new_button_creating() : m.user_new_button_create()}
						</button>
						<button
							type="submit"
							name="action"
							value="createAndNew"
							disabled={isSubmitting}
							class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
						>
							{isSubmitting ? m.user_new_button_creating() : m.user_new_button_create_another()}
						</button>
						<a
							href="{base}/users"
							class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-center font-medium"
						>
							{m.user_new_button_cancel()}
						</a>
					</div>

					<p class="text-sm text-gray-500 dark:text-gray-400">
						<strong>{m.user_new_help_create()}</strong> {m.user_new_help_create_text()}
						<strong>{m.user_new_help_create_another()}</strong> {m.user_new_help_create_another_text()}
					</p>
				</form>
			</div>
		</div>
	{:else}
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
			<p class="text-gray-600 dark:text-gray-400">
				{m.user_new_no_permission()}
			</p>
		</div>
	{/if}
</div>
