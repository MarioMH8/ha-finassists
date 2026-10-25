import { MockApiTokenRepository } from '@modules/tokens/infrastructure/repositories/mock-api-token.repository';
import { MockTokenCredentialService } from '@modules/tokens/infrastructure/services/mock-token-credential.service';
import { describe, expect, it } from 'bun:test';

import { IssueApiToken } from './issue-api-token.use-case';
import { IssueApiTokenParametersMother } from './issue-api-token.use-case.mother';

describe('IssueApiToken', () => {
	describe('execute', () => {
		it('should return the secret once and persist only its hash', async () => {
			const repository = new MockApiTokenRepository();
			const credentials = new MockTokenCredentialService();
			credentials.shouldCreate({ hash: 'hash:fa_test_secret', prefix: 'fa_test', secret: 'fa_test_secret' });
			const useCase = new IssueApiToken(repository, credentials);
			const parameters = IssueApiTokenParametersMother.create();

			const issued = await useCase.execute(parameters);

			expect(issued.secret).toBe('fa_test_secret');
			expect(issued.token).toMatchObject({
				name: parameters.name,
				ownerId: parameters.ownerId,
				prefix: 'fa_test',
				secretHash: 'hash:fa_test_secret',
			});
			expect(issued.token.secretHash).not.toBe(issued.secret);
			repository.assertSaveHasBeenCalledWith(issued.token);
		});
	});
});
