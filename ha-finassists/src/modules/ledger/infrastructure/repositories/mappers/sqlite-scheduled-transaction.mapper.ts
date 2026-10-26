import type {
	ScheduledTransactionFrequency,
	ScheduledTransactionPostingMode,
	ScheduledTransactionStatus,
	TransactionKind,
} from '@modules/ledger/domain';
import { ScheduledTransaction } from '@modules/ledger/domain';

export interface ScheduledTransactionRow {
	amount_minor: number;
	category_id: null | string;
	created_at: string;
	created_by: null | string;
	currency_code: string;
	description: string;
	end_date: null | string;
	frequency: ScheduledTransactionFrequency;
	id: string;
	interval: number;
	kind: TransactionKind;
	next_due_date: null | string;
	occurrence_number: number;
	posting_mode: ScheduledTransactionPostingMode;
	start_date: string;
	status: ScheduledTransactionStatus;
	version: number;
}

export class SqliteScheduledTransactionMapper {
	private constructor() {
		// Static-only mapper: instantiation is not part of the contract.
	}

	static toDomain(row: ScheduledTransactionRow): ScheduledTransaction {
		return ScheduledTransaction.restore({
			amountMinor: row.amount_minor,
			categoryId: row.category_id,
			createdAt: row.created_at,
			createdBy: row.created_by,
			currencyCode: row.currency_code,
			description: row.description,
			endDate: row.end_date,
			frequency: row.frequency,
			id: row.id,
			interval: row.interval,
			kind: row.kind,
			nextDueDate: row.next_due_date,
			occurrenceNumber: row.occurrence_number,
			postingMode: row.posting_mode,
			startDate: row.start_date,
			status: row.status,
			version: row.version,
		});
	}
}
