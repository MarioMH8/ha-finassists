import type {
	CategoryRepository,
	ScheduledTransactionFrequency,
	ScheduledTransactionPostingMode,
	ScheduledTransactionRepository,
	TransactionKind,
} from '@modules/ledger/domain';
import { ScheduledTransaction } from '@modules/ledger/domain';
import { Currency } from '@modules/money/domain';

import { requireCategory } from './require-category';

interface CreateScheduledTransactionInput {
	actorId: null | string;
	amountMinor: number;
	categoryId?: null | string;
	description?: string;
	endDate?: null | string;
	frequency: ScheduledTransactionFrequency;
	interval?: number;
	kind: TransactionKind;
	postingMode?: ScheduledTransactionPostingMode;
	startDate: string;
}

export class CreateScheduledTransaction {
	private readonly currencyCode: string;

	constructor(
		private readonly repository: ScheduledTransactionRepository,
		private readonly categoryRepository: CategoryRepository,
		currencyCode: string
	) {
		this.currencyCode = Currency.create(currencyCode).code;
	}

	async execute(input: CreateScheduledTransactionInput): Promise<ScheduledTransaction> {
		const category = await requireCategory(this.categoryRepository, input.categoryId);
		category?.assertAccepts(input.kind);
		const schedule = ScheduledTransaction.create({
			amountMinor: input.amountMinor,
			categoryId: category?.id ?? null,
			createdAt: new Date().toISOString(),
			createdBy: input.actorId,
			currencyCode: this.currencyCode,
			description: input.description ?? '',
			endDate: input.endDate ?? null,
			frequency: input.frequency,
			id: crypto.randomUUID(),
			interval: input.interval ?? 1,
			kind: input.kind,
			...(input.postingMode !== undefined && { postingMode: input.postingMode }),
			startDate: input.startDate,
		});
		await this.repository.save(schedule);

		return schedule;
	}
}

export type { CreateScheduledTransactionInput };
