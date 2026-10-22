import { describe, expect, it } from 'bun:test';

import { ApiTokenMother } from '../domain/api-token.mother';
import { InMemoryApiTokenRepository } from '../infrastructure';
import { ListApiTokens } from './list-api-tokens.use-case';

describe('ListApiTokens', () => {
	describe('execute', () => {
		it('returns only tokens owned by the requested user', async () => {
			const repository = new InMemoryApiTokenRepository();
			await repository.save(ApiTokenMother.create({ id: 'own-token', ownerId: 'user-1' }));
			await repository.save(ApiTokenMother.create({ id: 'other-token', ownerId: 'user-2' }));
			const useCase = new ListApiTokens(repository);

			const tokens = await useCase.execute('user-1');

			expect(tokens.map(token => token.id)).toEqual(['own-token']);
		});
	});
});
