import type {
	CategoryRepository,
	ScheduledTransaction,
	ScheduledTransactionFrequency,
	ScheduledTransactionPostingMode,
	ScheduledTransactionRepository,
	TransactionKind,
} from '@modules/ledger/domain';
import {
	SCHEDULED_TRANSACTION_STATUS,
	ScheduledTransactionCompletedError,
	ScheduledTransactionVersionConflictError,
} from '@modules/ledger/domain';

import { requireCategory } from './require-category';
import { requireScheduledTransaction } from './require-scheduled-transaction';

interface UpdateScheduledTransactionInput {
	amountMinor?: number;
	categoryId?: null | string;
	description?: string;
	endDate?: null | string;
	frequency?: ScheduledTransactionFrequency;
	id: string;
	interval?: number;
	kind?: TransactionKind;
	postingMode?: ScheduledTransactionPostingMode;
	startDate?: string;
	status?: 'active' | 'paused';
	today: string;
}

export class UpdateScheduledTransaction {
	constructor(
		private readonly repository: ScheduledTransactionRepository,
		private readonly categoryRepository: CategoryRepository
	) {}

	async execute(input: UpdateScheduledTransactionInput): Promise<ScheduledTransaction> {
		const existing = await requireScheduledTransaction(this.repository, input.id);
		if (existing.status === SCHEDULED_TRANSACTION_STATUS.COMPLETED) {
			throw new ScheduledTransactionCompletedError(existing.id);
		}
		const kind = input.kind ?? existing.kind;
		const requestedCategoryId = input.categoryId === undefined ? existing.categoryId : input.categoryId;
		const category = await requireCategory(this.categoryRepository, requestedCategoryId);
		category?.assertAccepts(kind);
		const hasChanges =
			input.amountMinor !== undefined ||
			input.categoryId !== undefined ||
			input.description !== undefined ||
			input.endDate !== undefined ||
			input.frequency !== undefined ||
			input.interval !== undefined ||
			input.kind !== undefined ||
			input.postingMode !== undefined ||
			input.startDate !== undefined;
		if (!hasChanges && input.status === undefined) {
			return existing;
		}
		let updated = hasChanges
			? existing.update(
					{
						...(input.amountMinor !== undefined && { amountMinor: input.amountMinor }),
						...(input.categoryId !== undefined && { categoryId: input.categoryId }),
						...(input.description !== undefined && { description: input.description }),
						...(input.endDate !== undefined && { endDate: input.endDate }),
						...(input.frequency !== undefined && { frequency: input.frequency }),
						...(input.interval !== undefined && { interval: input.interval }),
						...(input.kind !== undefined && { kind: input.kind }),
						...(input.postingMode !== undefined && { postingMode: input.postingMode }),
						...(input.startDate !== undefined && { startDate: input.startDate }),
					},
					input.today
				)
			: existing;
		if (input.status !== undefined) {
			if (updated.status === SCHEDULED_TRANSACTION_STATUS.COMPLETED) {
				throw new ScheduledTransactionCompletedError(updated.id);
			}
			if (
				input.status === SCHEDULED_TRANSACTION_STATUS.PAUSED &&
				updated.status === SCHEDULED_TRANSACTION_STATUS.ACTIVE
			) {
				updated = updated.pause();
			}
			if (
				input.status === SCHEDULED_TRANSACTION_STATUS.ACTIVE &&
				updated.status === SCHEDULED_TRANSACTION_STATUS.PAUSED
			) {
				updated = updated.resume(input.today);
			}
		}
		const isUpdated = await this.repository.update(updated, existing.version);
		if (!isUpdated) {
			throw new ScheduledTransactionVersionConflictError(existing.id);
		}

		return updated;
	}
}

export type { UpdateScheduledTransactionInput };
