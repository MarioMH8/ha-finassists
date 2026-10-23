import type { CreateTransactionInput, LedgerRepository } from '../domain';
import { validateTransactionInput } from '../domain';

class CreateTransaction {
	constructor(private readonly repository: LedgerRepository) {}

	execute(input: CreateTransactionInput): ReturnType<LedgerRepository['create']> {
		validateTransactionInput(input);

		return this.repository.create(input);
	}
}

export { CreateTransaction };
