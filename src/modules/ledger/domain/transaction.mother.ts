import type { FinancialTransactionProperties } from './transaction';
import { FinancialTransaction, TRANSACTION_STATUS } from './transaction';

const JSON_NULL = JSON.parse('null') as null;

class FinancialTransactionMother {
	static create(overrides: Partial<FinancialTransactionProperties> = {}): FinancialTransaction {
		return FinancialTransaction.create({
			accountId: 'account-1',
			actorId: JSON_NULL,
			amountMinor: -1250,
			bookId: 'book-1',
			id: 'transaction-1',
			memo: '',
			parts: [],
			payee: '',
			status: TRANSACTION_STATUS.UNCLEARED,
			transactionDate: '2026-03-01',
			transferId: JSON_NULL,
			...overrides,
		});
	}
}

export { FinancialTransactionMother };
