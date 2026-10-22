import { describe, expect, it } from 'bun:test';

import { ApiTokenMother } from '../domain/api-token.mother';
import { InMemoryApiTokenRepository, InMemoryTokenCredentialService } from '../infrastructure';
import { AuthenticateApiToken } from './authenticate-api-token.use-case';

describe('AuthenticateApiToken', () => {
	describe('execute', () => {
		it('returns the token owner when the secret is valid', async () => {
			const repository = new InMemoryApiTokenRepository();
			const credentials = new InMemoryTokenCredentialService();
			const secret = 'fa_external_secret';
			await repository.save(
				ApiTokenMother.create({ ownerId: 'user-1', secretHash: await credentials.hash(secret) })
			);
			const useCase = new AuthenticateApiToken(repository, credentials);

			const token = await useCase.execute(secret);

			expect(token?.ownerId).toBe('user-1');
		});
	});
});
