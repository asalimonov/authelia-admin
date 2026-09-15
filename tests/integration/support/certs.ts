import { join } from 'node:path';
import { GenericContainer, Wait } from 'testcontainers';
import { FIXTURES, IMAGES } from './containers';

export interface Certs {
	ca: string;
	wrongCa: string;
	serverCert: string;
	serverKey: string;
	clientCert: string;
	clientKey: string;
}

export async function generateCerts(): Promise<Certs> {
	const container = await new GenericContainer(IMAGES.postgres)
		.withEntrypoint(['sh', '-c', 'sh /gen-certs.sh /out && exec sleep infinity'])
		.withCopyFilesToContainer([{ source: join(FIXTURES, 'gen-certs.sh'), target: '/gen-certs.sh', mode: 0o755 }])
		.withWaitStrategy(Wait.forLogMessage('certificates ready'))
		.start();

	try {
		const read = async (name: string): Promise<string> => {
			const result = await container.exec(['cat', `/out/${name}`]);
			if (result.exitCode !== 0) {
				throw new Error(`Cannot read generated ${name}: ${result.output}`);
			}
			return result.stdout;
		};

		return {
			ca: await read('ca.pem'),
			wrongCa: await read('wrong-ca.pem'),
			serverCert: await read('server.pem'),
			serverKey: await read('server.key'),
			clientCert: await read('client.pem'),
			clientKey: await read('client.key')
		};
	} finally {
		await container.stop();
	}
}
