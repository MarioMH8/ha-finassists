import { describe, expect, it } from 'bun:test';

import { InMemoryApiTokenRepository, InMemoryTokenCredentialService } from '../infrastructure';
import { IssueApiToken } from './issue-api-token.use-case';
import { IssueApiTokenParametersMother } from './issue-api-token.use-case.mother';

describe('IssueApiToken', () => {
	describe('execute', () => {
		it('returns the secret once and persists only its hash', async () => {
			const repository = new InMemoryApiTokenRepository();
			const useCase = new IssueApiToken(repository, new InMemoryTokenCredentialService());
			const parameters = IssueApiTokenParametersMother.create();

			const issued = await useCase.execute(parameters);
			const [stored] = await repository.search({ ownerId: parameters.ownerId });

			expect(issued.secret).toBe('fa_test_secret');
			expect(stored.secretHash).toBe('hash:fa_test_secret');
			expect(stored.secretHash).not.toBe(issued.secret);
			expect(issued.token.name).toBe(parameters.name);
		});
	});
});
