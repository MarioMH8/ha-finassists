import { ApiTokenMother } from '@modules/tokens/domain/api-token.mother';
import { MockApiTokenRepository } from '@modules/tokens/infrastructure/repositories/mock-api-token.repository';
import { describe, expect, it } from 'bun:test';

import { ListApiTokens } from './list-api-tokens.use-case';

describe('ListApiTokens', () => {
	describe('execute', () => {
		it('should return the tokens owned by the requested user', async () => {
			const repository = new MockApiTokenRepository();
			const tokens = [ApiTokenMother.create({ id: 'own-token', ownerId: 'user-1' })];
			repository.shouldSearch(tokens);
			const useCase = new ListApiTokens(repository);

			expect(await useCase.execute('user-1')).toEqual(tokens);
			repository.assertSearchHasBeenCalledWith({ ownerId: 'user-1' });
		});
	});
});
