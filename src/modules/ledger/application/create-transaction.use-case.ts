import type { CreateTransactionInput, LedgerRepository } from '@modules/ledger/domain';
import { FinancialTransaction } from '@modules/ledger/domain';

class CreateTransaction {
	constructor(private readonly repository: LedgerRepository) {}

	execute(input: CreateTransactionInput): ReturnType<LedgerRepository['create']> {
		FinancialTransaction.validateCreate(input);

		return this.repository.create(input);
	}
}

export { CreateTransaction };
