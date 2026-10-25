import { ApiTokenMother } from '@modules/tokens/domain/api-token.mother';
import { MockApiTokenRepository } from '@modules/tokens/infrastructure/repositories/mock-api-token.repository';
import { MockTokenCredentialService } from '@modules/tokens/infrastructure/services/mock-token-credential.service';
import { describe, expect, it } from 'bun:test';

import { AuthenticateApiToken } from './authenticate-api-token.use-case';

describe('AuthenticateApiToken', () => {
	describe('execute', () => {
		it('should return the stored token when its hash matches the secret', async () => {
			const repository = new MockApiTokenRepository();
			const credentials = new MockTokenCredentialService();
			const stored = ApiTokenMother.create({ ownerId: 'user-1', secretHash: 'hash:secret' });
			credentials.shouldHash('fa_external_secret', 'hash:secret');
			repository.shouldFind(stored);
			const useCase = new AuthenticateApiToken(repository, credentials);

			const token = await useCase.execute('fa_external_secret');

			expect(token).toBe(stored);
			credentials.assertHashHasBeenCalledWith('fa_external_secret');
			repository.assertFindHasBeenCalledWith({ secretHash: 'hash:secret' });
		});

		it('should return undefined when no token matches the secret hash', async () => {
			const repository = new MockApiTokenRepository();
			const credentials = new MockTokenCredentialService();
			credentials.shouldHash('unknown', 'hash:unknown');
			const useCase = new AuthenticateApiToken(repository, credentials);

			expect(await useCase.execute('unknown')).toBeUndefined();
		});
	});
});
