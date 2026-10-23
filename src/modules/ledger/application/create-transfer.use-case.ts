import type { CreateTransferInput, LedgerRepository } from '../domain';
import { validateTransferInput } from '../domain';

class CreateTransfer {
	constructor(private readonly repository: LedgerRepository) {}

	execute(input: CreateTransferInput): ReturnType<LedgerRepository['createTransfer']> {
		validateTransferInput(input);

		return this.repository.createTransfer(input);
	}
}

export { CreateTransfer };
