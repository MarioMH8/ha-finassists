import type {
	ScheduledTransactionPostingMode,
	ScheduledTransactionRepository,
	TransactionKind,
} from '@modules/ledger/domain';
import { isCalendarDate, ScheduledTransactionProjectionRangeInvalidError } from '@modules/ledger/domain';
import { Currency } from '@modules/money/domain';

const MAX_FORECAST_SCHEDULES = 1000;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

interface ListUpcomingScheduledTransactionsInput {
	categoryId?: string;
	fromDate: string;
	kind?: TransactionKind;
	limit?: number;
	offset?: number;
	toDate: string;
}

interface UpcomingScheduledTransactionItem {
	amountMinor: number;
	categoryId: null | string;
	currencyCode: string;
	description: string;
	dueDate: string;
	kind: TransactionKind;
	postingMode: ScheduledTransactionPostingMode;
	scheduleId: string;
}

interface UpcomingScheduledTransactions {
	byCategory: {
		expense: Record<string, number>;
		income: Record<string, number>;
	};
	currencyCode: string;
	items: UpcomingScheduledTransactionItem[];
	total: number;
	totals: {
		expenseMinor: number;
		incomeMinor: number;
		netMinor: number;
	};
	uncategorized: {
		expenseMinor: number;
		incomeMinor: number;
	};
}

export class ListUpcomingScheduledTransactions {
	private readonly currencyCode: string;

	constructor(
		private readonly repository: ScheduledTransactionRepository,
		currencyCode: string
	) {
		this.currencyCode = Currency.create(currencyCode).code;
	}

	async execute(input: ListUpcomingScheduledTransactionsInput): Promise<UpcomingScheduledTransactions> {
		if (!isCalendarDate(input.fromDate) || !isCalendarDate(input.toDate) || input.fromDate > input.toDate) {
			throw new ScheduledTransactionProjectionRangeInvalidError();
		}
		const limit = input.limit ?? DEFAULT_LIMIT;
		if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
			throw new RangeError(`limit must be between 1 and ${MAX_LIMIT.toString()}`);
		}
		const offset = input.offset ?? 0;
		if (!Number.isSafeInteger(offset) || offset < 0) {
			throw new RangeError('offset must be a non-negative integer');
		}
		const page = await this.repository.search({
			limit: MAX_FORECAST_SCHEDULES,
			status: 'active',
			...(input.categoryId !== undefined && { categoryId: input.categoryId }),
			...(input.kind !== undefined && { kind: input.kind }),
		});
		const items: UpcomingScheduledTransactionItem[] = [];
		for (const schedule of page.items) {
			if (schedule.status !== 'active' || schedule.currencyCode !== this.currencyCode) {
				continue;
			}
			if (input.kind !== undefined && schedule.kind !== input.kind) {
				continue;
			}
			if (input.categoryId !== undefined && schedule.categoryId !== input.categoryId) {
				continue;
			}
			for (const occurrence of schedule.projectOccurrences(input.fromDate, input.toDate)) {
				items.push({
					amountMinor: schedule.amountMinor,
					categoryId: schedule.categoryId,
					currencyCode: schedule.currencyCode,
					description: schedule.description,
					dueDate: occurrence.dueDate,
					kind: schedule.kind,
					postingMode: schedule.postingMode,
					scheduleId: schedule.id,
				});
			}
		}
		items.sort((first, second) => {
			if (first.dueDate !== second.dueDate) {
				return first.dueDate < second.dueDate ? -1 : 1;
			}
			if (first.kind !== second.kind) {
				return first.kind === 'expense' ? -1 : 1;
			}

			return first.scheduleId.localeCompare(second.scheduleId);
		});
		const totals = { expenseMinor: 0, incomeMinor: 0, netMinor: 0 };
		const byCategory: UpcomingScheduledTransactions['byCategory'] = { expense: {}, income: {} };
		const uncategorized = { expenseMinor: 0, incomeMinor: 0 };
		for (const item of items) {
			if (item.kind === 'income') {
				totals.incomeMinor += item.amountMinor;
			} else {
				totals.expenseMinor += item.amountMinor;
			}
			if (item.categoryId === null) {
				if (item.kind === 'income') {
					uncategorized.incomeMinor += item.amountMinor;
				} else {
					uncategorized.expenseMinor += item.amountMinor;
				}
			} else {
				const amounts = byCategory[item.kind];
				amounts[item.categoryId] = (amounts[item.categoryId] ?? 0) + item.amountMinor;
			}
		}
		totals.netMinor = totals.incomeMinor - totals.expenseMinor;

		return {
			byCategory,
			currencyCode: this.currencyCode,
			items: items.slice(offset, offset + limit),
			total: items.length,
			totals,
			uncategorized,
		};
	}
}

export type { ListUpcomingScheduledTransactionsInput, UpcomingScheduledTransactionItem, UpcomingScheduledTransactions };
