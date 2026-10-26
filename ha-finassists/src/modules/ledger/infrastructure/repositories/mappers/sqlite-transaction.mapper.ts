import type { TransactionKind } from '@modules/ledger/domain';
import { Transaction } from '@modules/ledger/domain';

export interface TransactionRow {
	actor_id: null | string;
	amount_minor: number;
	category_id: null | string;
	created_at: string;
	currency_code: string;
	description: string;
	id: string;
	kind: TransactionKind;
	transaction_date: string;
}

export class SqliteTransactionMapper {
	private constructor() {
		// Static-only mapper: instantiation is not part of the contract.
	}

	static toDomain(row: TransactionRow): Transaction {
		return Transaction.create({
			actorId: row.actor_id,
			amountMinor: row.amount_minor,
			categoryId: row.category_id,
			createdAt: row.created_at,
			currencyCode: row.currency_code,
			description: row.description,
			id: row.id,
			kind: row.kind,
			transactionDate: row.transaction_date,
		});
	}
}
