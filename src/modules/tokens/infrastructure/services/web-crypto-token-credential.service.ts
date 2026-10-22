import { Buffer } from 'node:buffer';

import type { TokenCredential, TokenCredentialService } from '../../domain';

const TOKEN_PREFIX_LENGTH = 11;

export class WebCryptoTokenCredentialService implements TokenCredentialService {
	async create(): Promise<TokenCredential> {
		const bytes = crypto.getRandomValues(new Uint8Array(32));
		const secret = `fa_${Buffer.from(bytes).toString('base64url')}`;

		return {
			hash: await this.hash(secret),
			prefix: secret.slice(0, TOKEN_PREFIX_LENGTH),
			secret,
		};
	}

	async hash(secret: string): Promise<string> {
		const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));

		return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
	}
}
