import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { expect } from 'vitest';
import { ExitedStrategy, IMAGES, ROOT, containerExitCode, containerLogs } from './containers';
import type { Stack } from './stack';

export interface AdminFile {
	content: string;
	target: string;
}

export interface AdminOptions {
	env?: Record<string, string>;
	autheliaConfig?: string;
	files?: AdminFile[];
	mountSqlite?: boolean;
}

export interface Admin {
	container: StartedTestContainer;
	health(): Promise<number>;
	logs(): Promise<string>;
	stop(): Promise<void>;
}

export async function startAdmin(stack: Stack, options: AdminOptions, expectExit = false): Promise<Admin> {
	const contents = (options.files ?? []).map((file) => ({ ...file, mode: 0o644 }));
	if (options.autheliaConfig !== undefined) {
		contents.push({ content: options.autheliaConfig, target: '/config/configuration.yml', mode: 0o644 });
	}

	let builder = new GenericContainer(IMAGES.admin)
		.withNetwork(stack.network)
		.withNetworkAliases('authelia-admin')
		.withEnvironment({
			TZ: 'UTC',
			AAD_LOGLEVEL: 'INFO',
			NODE_TLS_REJECT_UNAUTHORIZED: '0',
			TRUSTED_ORIGINS: 'https://auth.localhost.test',
			...options.env
		})
		.withCopyFilesToContainer([
			{ source: join(ROOT, 'test-configs/config.yml'), target: '/opt/authelia-admin/config.yml', mode: 0o644 }
		])
		.withStartupTimeout(60_000);

	if (contents.length > 0) {
		builder = builder.withCopyContentToContainer(contents);
	}
	if (options.mountSqlite && stack.sqliteDir) {
		builder = builder.withBindMounts([{ source: stack.sqliteDir, target: '/data' }]);
	}
	builder = expectExit
		? builder.withWaitStrategy(new ExitedStrategy())
		: builder.withExposedPorts(9093).withWaitStrategy(Wait.forLogMessage(/Listening on/));

	const container = await builder.start();

	return {
		container,
		async health() {
			const url = `http://${container.getHost()}:${container.getMappedPort(9093)}/auth-admin/health`;
			return (await fetch(url)).status;
		},
		logs: () => containerLogs(container),
		async stop() {
			await container.stop();
		}
	};
}

export async function expectHealth(
	stack: Stack,
	options: AdminOptions,
	expected: 200 | 500,
	logPattern?: RegExp
): Promise<void> {
	const admin = await startAdmin(stack, options);
	try {
		let status = await admin.health();
		for (let attempt = 0; expected === 200 && status !== 200 && attempt < 10; attempt++) {
			await sleep(1_000);
			status = await admin.health();
		}
		const logs = await admin.logs();
		expect(status, logs).toBe(expected);
		if (logPattern) {
			expect(logs).toMatch(logPattern);
		}
	} finally {
		await admin.stop();
	}
}

export async function expectStartupFailure(
	stack: Stack,
	options: AdminOptions,
	logPattern: RegExp,
	secret?: string
): Promise<void> {
	const admin = await startAdmin(stack, options, true);
	try {
		const logs = await admin.logs();
		expect(await containerExitCode(admin.container), logs).toBe(1);
		expect(logs).toMatch(logPattern);
		if (secret !== undefined) {
			expect(logs).not.toContain(secret);
		}
	} finally {
		await admin.stop();
	}
}
