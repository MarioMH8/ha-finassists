import { Buffer } from 'node:buffer';

const SUPERVISOR_DISCOVERY_URL = 'http://supervisor/discovery';
const SUPERVISOR_REQUEST_TIMEOUT_MS = 10_000;

type SupervisorFetcher = (input: string, init: RequestInit) => Promise<Response>;

class BootstrapCapability {
	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static create(): string {
		const randomBytes = crypto.getRandomValues(new Uint8Array(32));

		return `fa_bootstrap_${Buffer.from(randomBytes).toString('base64url')}`;
	}
}

class SupervisorDiscovery {
	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static async publish(
		supervisorToken: string,
		bootstrapCapability: string,
		fetcher: SupervisorFetcher = (input, init) => fetch(input, init)
	): Promise<void> {
		let response: Response;
		try {
			response = await fetcher(SUPERVISOR_DISCOVERY_URL, {
				body: JSON.stringify({
					config: {
						bootstrapCapability,
					},
					service: 'ha_finassists',
				}),
				headers: {
					Authorization: `Bearer ${supervisorToken}`,
					'Content-Type': 'application/json',
				},
				method: 'POST',
				redirect: 'error',
				signal: AbortSignal.timeout(SUPERVISOR_REQUEST_TIMEOUT_MS),
			});
		} catch {
			throw new Error('Home Assistant Supervisor discovery publishing failed');
		}

		if (!response.ok) {
			throw new Error(`Home Assistant Supervisor discovery publishing failed (HTTP ${String(response.status)})`);
		}
	}
}

export { BootstrapCapability, SupervisorDiscovery };
