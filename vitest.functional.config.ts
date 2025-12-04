import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.functional.{test,spec}.{js,ts}'],
		environment: 'node',
		testTimeout: 30000,
		hookTimeout: 30000
	}
});
