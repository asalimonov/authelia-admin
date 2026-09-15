import { fileURLToPath } from 'node:url';
import type Dockerode from 'dockerode';
import {
	StartupCheckStrategy,
	getContainerRuntimeClient,
	type StartedTestContainer,
	type StartupStatus
} from 'testcontainers';

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const FIXTURES = fileURLToPath(new URL('../fixtures/', import.meta.url));

export const IMAGES = {
	admin: process.env.AAD_TEST_IMAGE || 'authelia-admin:latest',
	authelia: 'authelia/authelia:4.39.6',
	lldap: 'lldap/lldap:v0.6.2-debian',
	postgres: 'postgres:18',
	traefik: 'traefik:latest'
};

export class ExitedStrategy extends StartupCheckStrategy {
	async checkStartupState(dockerClient: Dockerode, containerId: string): Promise<StartupStatus> {
		const info = await dockerClient.getContainer(containerId).inspect();
		return info.State.Status === 'exited' ? 'SUCCESS' : 'PENDING';
	}
}

export async function containerLogs(container: StartedTestContainer): Promise<string> {
	const client = await getContainerRuntimeClient();
	const raw = await client.container.dockerode
		.getContainer(container.getId())
		.logs({ stdout: true, stderr: true, follow: false });
	return demultiplex(raw);
}

export async function containerExitCode(container: StartedTestContainer): Promise<number> {
	const client = await getContainerRuntimeClient();
	const info = await client.container.dockerode.getContainer(container.getId()).inspect();
	return info.State.ExitCode;
}

function demultiplex(buffer: Buffer): string {
	const chunks: string[] = [];
	let offset = 0;
	while (offset + 8 <= buffer.length) {
		const size = buffer.readUInt32BE(offset + 4);
		chunks.push(buffer.subarray(offset + 8, offset + 8 + size).toString('utf8'));
		offset += 8 + size;
	}
	return chunks.join('');
}
