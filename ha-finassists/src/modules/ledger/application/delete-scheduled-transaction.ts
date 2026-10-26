import type { ScheduledTransactionRepository } from '@modules/ledger/domain';
import { ScheduledTransactionNotFoundError } from '@modules/ledger/domain';

interface DeleteScheduledTransactionInput {
	id: string;
}

export class DeleteScheduledTransaction {
	constructor(private readonly repository: ScheduledTransactionRepository) {}

	async execute({ id }: DeleteScheduledTransactionInput): Promise<void> {
		const isDeleted = await this.repository.delete(id);
		if (!isDeleted) {
			throw new ScheduledTransactionNotFoundError(id);
		}
	}
}

export type { DeleteScheduledTransactionInput };
