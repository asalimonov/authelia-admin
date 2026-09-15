import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		include: ['tests/integration/**/*.test.ts'],
		environment: 'node',
		fileParallelism: false,
		testTimeout: 180_000,
		hookTimeout: 600_000
	}
});
