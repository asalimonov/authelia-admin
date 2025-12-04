import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';

export default defineConfig({
	plugins: [
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide',
			strategy: ['cookie', 'baseLocale']
		}),
		tailwindcss(),
		sveltekit()
	],
	server: {
		host: true,
		allowedHosts: true,
		port: 9093,
		strictPort: true,
		// // Disable HMR for production preview
		// hmr: process.env.NODE_ENV === 'production' ? false : {
		// 	port: 9094,
		// 	host: 'localhost'
		// }
	},
	build: {
		rollupOptions: {
			// Keep native modules external but bundle the rest
			external: ['sqlite3', 'ldapts'],
			output: {
				// Inline dynamic imports to reduce chunk count
				inlineDynamicImports: true,
				// Single bundle for server
				manualChunks: undefined
			}
		},
		// Increase chunk size limit to allow bundling
		chunkSizeWarningLimit: 2000,
		// Bundle all dependencies except native ones
		commonjsOptions: {
			include: [/node_modules/],
			transformMixedEsModules: true
		}
	},
	ssr: {
		// Bundle non-native dependencies
		noExternal: ['yaml'],
		// Keep native modules external
		external: ['sqlite3', 'ldapts'],
		// Optimize deps for development
		optimizeDeps: {
			include: ['yaml']
		}
	}
});