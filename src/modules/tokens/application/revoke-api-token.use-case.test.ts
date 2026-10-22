import { describe, expect, it } from 'bun:test';

import { ApiTokenMother } from '../domain/api-token.mother';
import { InMemoryApiTokenRepository } from '../infrastructure';
import { RevokeApiTokenParametersMother } from './revoke-api-token.parameters.mother';
import { RevokeApiToken } from './revoke-api-token.use-case';

describe('RevokeApiToken', () => {
	describe('execute', () => {
		it('does not revoke a token owned by another user', async () => {
			const repository = new InMemoryApiTokenRepository();
			await repository.save(ApiTokenMother.create({ id: 'other-token', ownerId: 'user-2' }));
			const useCase = new RevokeApiToken(repository);
			const parameters = RevokeApiTokenParametersMother.create({ id: 'other-token' });

			const isRevoked = await useCase.execute(parameters);

			expect(isRevoked).toBe(false);
			expect(await repository.findAllByOwner('user-2')).toHaveLength(1);
		});
	});
});
