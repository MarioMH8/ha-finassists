import { describe, expect, it } from 'bun:test';

import { MockApiTokenRepository } from '../infrastructure/repositories/mock-api-token.repository';
import { RevokeApiToken } from './revoke-api-token.use-case';
import { RevokeApiTokenParametersMother } from './revoke-api-token.use-case.mother';

describe('RevokeApiToken', () => {
	describe('execute', () => {
		it('should return true when the repository deletes the owned token', async () => {
			const repository = new MockApiTokenRepository();
			repository.shouldDelete(true);
			const useCase = new RevokeApiToken(repository);
			const parameters = RevokeApiTokenParametersMother.create();

			expect(await useCase.execute(parameters)).toBe(true);
			repository.assertDeleteHasBeenCalledWith({ id: 'token-1', ownerId: 'user-1' });
		});

		it('should return false when the token is owned by another user', async () => {
			const repository = new MockApiTokenRepository();
			const useCase = new RevokeApiToken(repository);
			const parameters = RevokeApiTokenParametersMother.create({ id: 'other-token' });

			expect(await useCase.execute(parameters)).toBe(false);
			repository.assertDeleteHasBeenCalledWith({ id: 'other-token', ownerId: 'user-1' });
		});
	});
});
