import type { TransactionProperties } from './transaction';
import { Transaction } from './transaction';

export class TransactionMother {
	static create(overrides: Partial<TransactionProperties> = {}): Transaction {
		return Transaction.create({
			actorId: 'user-1',
			amountMinor: 1250,
			categoryId: null,
			createdAt: '2026-05-15T10:00:00.000Z',
			currencyCode: 'EUR',
			description: 'Groceries',
			id: 'transaction-1',
			kind: 'expense',
			transactionDate: '2026-05-15',
			...overrides,
		});
	}
}
