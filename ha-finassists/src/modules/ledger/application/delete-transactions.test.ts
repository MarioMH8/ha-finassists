import { MockLedgerRepository } from '@modules/ledger/infrastructure/repositories/mock-ledger.repository';
import { beforeEach, describe, expect, it } from 'bun:test';

import { DeleteTransactions } from './delete-transactions';

describe('DeleteTransactions', () => {
	let repository: MockLedgerRepository;
	let useCase: DeleteTransactions;

	beforeEach(() => {
		repository = new MockLedgerRepository();
		useCase = new DeleteTransactions(repository);
	});

	it('deletes unique transaction identifiers', async () => {
		repository.shouldDeleteMany(2);

		const deleted = await useCase.execute({ ids: ['a', 'b', 'a'] });

		expect(deleted).toBe(2);
	});

	it('reports nothing deleted for an empty selection', async () => {
		repository.shouldDeleteMany(0);

		expect(await useCase.execute({ ids: [] })).toBe(0);
	});
});
