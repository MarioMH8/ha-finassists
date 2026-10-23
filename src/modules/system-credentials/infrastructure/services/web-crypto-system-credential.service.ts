import { Buffer } from 'node:buffer';

import type { SystemCredentialSecret, SystemCredentialService } from '../../domain';

const SYSTEM_CREDENTIAL_PREFIX_LENGTH = 11;

class WebCryptoSystemCredentialService implements SystemCredentialService {
	async create(): Promise<SystemCredentialSecret> {
		const bytes = crypto.getRandomValues(new Uint8Array(32));
		const secret = `fa_system_${Buffer.from(bytes).toString('base64url')}`;

		return {
			hash: await this.hash(secret),
			prefix: secret.slice(0, SYSTEM_CREDENTIAL_PREFIX_LENGTH),
			secret,
		};
	}

	async hash(secret: string): Promise<string> {
		const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));

		return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
	}
}

export { WebCryptoSystemCredentialService };
