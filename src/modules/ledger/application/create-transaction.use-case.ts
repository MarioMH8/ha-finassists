import type { CreateTransactionInput, LedgerRepository } from '../domain';
import { FinancialTransaction } from '../domain';

class CreateTransaction {
	constructor(private readonly repository: LedgerRepository) {}

	execute(input: CreateTransactionInput): ReturnType<LedgerRepository['create']> {
		FinancialTransaction.validateCreate(input);

		return this.repository.create(input);
	}
}

export { CreateTransaction };
