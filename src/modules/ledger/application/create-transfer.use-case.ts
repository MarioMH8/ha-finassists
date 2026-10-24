import type { CreateTransferInput, LedgerRepository } from '@modules/ledger/domain';
import { FinancialTransaction } from '@modules/ledger/domain';

class CreateTransfer {
	constructor(private readonly repository: LedgerRepository) {}

	execute(input: CreateTransferInput): ReturnType<LedgerRepository['createTransfer']> {
		FinancialTransaction.validateTransfer(input);

		return this.repository.createTransfer(input);
	}
}

export { CreateTransfer };
