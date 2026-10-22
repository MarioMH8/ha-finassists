import { describe, expect, it } from 'bun:test';

import { WebCryptoTokenCredentialService } from './web-crypto-token-credential.service';

describe('WebCryptoTokenCredentialService', () => {
	describe('hash', () => {
		it('returns a SHA-256 digest of the secret', async () => {
			const service = new WebCryptoTokenCredentialService();

			expect(await service.hash('hello')).toBe(
				'2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
			);
		});
	});
});
