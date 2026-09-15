import type { IncomingHttpHeaders } from 'node:http';
import { request } from 'node:https';
import type { Stack } from './stack';

const AUTH_HOST = 'auth.localhost.test';

export interface HttpResponse {
	status: number;
	headers: IncomingHttpHeaders;
	body: string;
}

export class AutheliaClient {
	private readonly cookies = new Map<string, string>();

	constructor(
		private readonly host: string,
		private readonly port: number
	) {}

	async send(
		method: string,
		path: string,
		options: { headers?: Record<string, string>; body?: string } = {}
	): Promise<HttpResponse> {
		const headers: Record<string, string> = { Host: AUTH_HOST, ...options.headers };
		if (this.cookies.size > 0) {
			headers.Cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
		}
		if (options.body !== undefined) {
			headers['Content-Length'] = String(Buffer.byteLength(options.body));
		}

		const response = await new Promise<HttpResponse>((resolve, reject) => {
			const req = request(
				{
					host: this.host,
					port: this.port,
					method,
					path,
					headers,
					servername: AUTH_HOST,
					rejectUnauthorized: false
				},
				(res) => {
					const chunks: Buffer[] = [];
					res.on('data', (chunk: Buffer) => chunks.push(chunk));
					res.on('error', reject);
					res.on('end', () =>
						resolve({
							status: res.statusCode ?? 0,
							headers: res.headers,
							body: Buffer.concat(chunks).toString('utf8')
						})
					);
				}
			);
			req.on('error', reject);
			req.end(options.body);
		});

		for (const cookie of response.headers['set-cookie'] ?? []) {
			const [pair] = cookie.split(';');
			const separator = pair.indexOf('=');
			this.cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
		}
		return response;
	}

	async login(username: string, password: string): Promise<void> {
		const response = await this.send('POST', '/api/firstfactor', {
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username, password, keepMeLoggedIn: false })
		});
		if (response.status !== 200) {
			throw new Error(`Authelia login failed with ${response.status}: ${response.body}`);
		}
	}
}

export interface BanResult {
	ip: string;
	action: HttpResponse;
	page: HttpResponse;
}

export async function banIpThroughUi(stack: Stack): Promise<BanResult> {
	const client = new AutheliaClient(stack.traefikHost, stack.traefikPort);
	await client.login('admin', 'admin1234');

	const ip = `203.0.113.${1 + Math.floor(Math.random() * 254)}`;
	const action = await client.send('POST', '/auth-admin/banned/ip?/create', {
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
			Origin: `https://${AUTH_HOST}`,
			'x-sveltekit-action': 'true'
		},
		body: new URLSearchParams({ ip, permanent: 'true', reason: 'integration test' }).toString()
	});
	const page = await client.send('GET', '/auth-admin/banned/ip');
	return { ip, action, page };
}
