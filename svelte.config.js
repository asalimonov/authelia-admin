import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// adapter-node options
		adapter: adapter({
			// default options
			out: 'build',
			precompress: false,
			envPrefix: '',
		}),
		alias: {
			'$lib': './src/lib',
			'$lib/*': './src/lib/*'
		},
		// Set base path for the application
		paths: {
			base: '/auth-admin',
			relative: false
		},
		// The public origin is read at runtime from TRUSTED_ORIGINS (see src/lib/server/csrf.ts).
		// A build-time list would reject every host that was not known when the image or .deb was built.
		csrf: {
			trustedOrigins: ['*']
		}
	}
};

export default config;