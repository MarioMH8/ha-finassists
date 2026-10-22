import type { TokenCredentialService } from '../domain';

export class InMemoryTokenCredentialService implements TokenCredentialService {
	async create(): Promise<{ hash: string; prefix: string; secret: string }> {
		return {
			hash: await this.hash('fa_test_secret'),
			prefix: 'fa_test',
			secret: 'fa_test_secret',
		};
	}

	async hash(secret: string): Promise<string> {
		await Promise.resolve();

		return `hash:${secret}`;
	}
}
