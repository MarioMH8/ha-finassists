import { randomUUID } from 'node:crypto';

import type { Database } from 'bun:sqlite';

import type {
	CreateTransactionInput,
	CreateTransferInput,
	FinancialTransaction,
	LedgerRepository,
	TransactionPart,
	TransactionStatus,
} from '../../domain';

const JSON_NULL = JSON.parse('null') as null;

interface TransactionRow {
	account_id: string;
	actor_id: null | string;
	amount_minor: number;
	book_id: string;
	id: string;
	memo: string;
	payee: string;
	status: TransactionStatus;
	transaction_date: string;
	transfer_id: null | string;
}

interface PartRow {
	amount_minor: number;
	category_id: null | string;
	class_id: null | string;
	id: string;
	memo: string;
}

function toTransaction(row: TransactionRow, parts: TransactionPart[]): FinancialTransaction {
	return {
		accountId: row.account_id,
		actorId: row.actor_id,
		amountMinor: row.amount_minor,
		bookId: row.book_id,
		id: row.id,
		memo: row.memo,
		parts,
		payee: row.payee,
		status: row.status,
		transactionDate: row.transaction_date,
		transferId: row.transfer_id,
	};
}

class SqliteLedgerRepository implements LedgerRepository {
	constructor(private readonly database: Database) {}

	create(input: CreateTransactionInput): FinancialTransaction {
		const id = randomUUID();
		const create = this.database.transaction(() => {
			this.database
				.query(
					`
				INSERT INTO transactions
					(id, book_id, account_id, transaction_date, payee, memo, amount_minor, status, actor_id)
				VALUES (?, ?, ?, ?, ?, ?, ?, 'uncleared', ?)
			`
				)
				.run(
					id,
					input.bookId,
					input.accountId,
					input.transactionDate,
					input.payee?.trim() ?? '',
					input.memo?.trim() ?? '',
					input.amountMinor,
					input.actorId ?? JSON_NULL
				);

			const parts = input.parts ?? [];
			for (const [position, part] of parts.entries()) {
				this.database
					.query(
						`
					INSERT INTO transaction_parts (id, book_id, transaction_id, category_id, class_id, amount_minor, memo, position)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				`
					)
					.run(
						randomUUID(),
						input.bookId,
						id,
						part.categoryId ?? JSON_NULL,
						part.classId ?? JSON_NULL,
						part.amountMinor,
						part.memo?.trim() ?? '',
						position
					);
			}

			return this.find(input.bookId, id);
		});
		const transaction = create();
		if (!transaction) {
			throw new Error('Created transaction could not be read');
		}

		return transaction;
	}

	createTransfer(input: CreateTransferInput): { from: FinancialTransaction; id: string; to: FinancialTransaction } {
		const transferId = randomUUID();
		const fromId = randomUUID();
		const toId = randomUUID();
		const create = this.database.transaction(() => {
			this.database
				.query(
					`
				INSERT INTO transfers (id, book_id, from_account_id, to_account_id, amount_minor, transaction_date, created_by)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			`
				)
				.run(
					transferId,
					input.bookId,
					input.fromAccountId,
					input.toAccountId,
					input.amountMinor,
					input.transactionDate,
					input.actorId ?? JSON_NULL
				);
			const insertLeg = this.database.query(`
				INSERT INTO transactions
					(id, book_id, account_id, transfer_id, transaction_date, memo, amount_minor, status, actor_id)
				VALUES (?, ?, ?, ?, ?, ?, ?, 'uncleared', ?)
			`);
			insertLeg.run(
				fromId,
				input.bookId,
				input.fromAccountId,
				transferId,
				input.transactionDate,
				input.memo?.trim() ?? '',
				-input.amountMinor,
				input.actorId ?? JSON_NULL
			);
			insertLeg.run(
				toId,
				input.bookId,
				input.toAccountId,
				transferId,
				input.transactionDate,
				input.memo?.trim() ?? '',
				input.amountMinor,
				input.actorId ?? JSON_NULL
			);

			const from = this.find(input.bookId, fromId);
			const to = this.find(input.bookId, toId);
			if (!from || !to) {
				throw new Error('Created transfer could not be read');
			}

			return { from, id: transferId, to };
		});

		return create();
	}

	find(bookId: string, id: string): FinancialTransaction | undefined {
		const row = this.database
			.query('SELECT * FROM transactions WHERE book_id = ? AND id = ?')
			.get(bookId, id) as null | TransactionRow;
		if (!row) {
			return undefined;
		}

		return toTransaction(row, this.readParts(bookId, id));
	}

	list(bookId: string, accountId: string): FinancialTransaction[] {
		const rows = this.database
			.query(
				'SELECT * FROM transactions WHERE book_id = ? AND account_id = ? ORDER BY transaction_date DESC, id DESC'
			)
			.all(bookId, accountId) as TransactionRow[];

		return rows.map(row => toTransaction(row, this.readParts(bookId, row.id)));
	}

	remove(bookId: string, id: string): boolean {
		const remove = this.database.transaction(() => {
			const transaction = this.database
				.query(`SELECT transfer_id FROM transactions WHERE book_id = ? AND id = ? AND status != 'reconciled'`)
				.get(bookId, id) as null | { transfer_id: null | string };
			if (!transaction) {
				return false;
			}

			if (transaction.transfer_id === null) {
				return (
					this.database.query('DELETE FROM transactions WHERE book_id = ? AND id = ?').run(bookId, id)
						.changes > 0
				);
			}

			const reconciledLeg = this.database
				.query(`SELECT 1 FROM transactions WHERE book_id = ? AND transfer_id = ? AND status = 'reconciled'`)
				.get(bookId, transaction.transfer_id);
			if (reconciledLeg) {
				return false;
			}

			const legs = this.database
				.query('SELECT id FROM transactions WHERE book_id = ? AND transfer_id = ?')
				.all(bookId, transaction.transfer_id) as { id: string }[];
			if (legs.length !== 2) {
				throw new Error('Transfer must have exactly two transaction legs');
			}
			this.database
				.query('UPDATE transactions SET transfer_id = NULL WHERE book_id = ? AND transfer_id = ?')
				.run(bookId, transaction.transfer_id);
			this.database
				.query('DELETE FROM transfers WHERE book_id = ? AND id = ?')
				.run(bookId, transaction.transfer_id);
			const legDeleteQuery = this.database.query('DELETE FROM transactions WHERE book_id = ? AND id = ?');
			for (const leg of legs) {
				legDeleteQuery.run(bookId, leg.id);
			}

			return true;
		});

		return remove();
	}

	setStatus(bookId: string, id: string, status: TransactionStatus): boolean {
		return (
			this.database
				.query('UPDATE transactions SET status = ? WHERE book_id = ? AND id = ?')
				.run(status, bookId, id).changes > 0
		);
	}

	update(
		bookId: string,
		id: string,
		input: import('../../domain').UpdateTransactionInput
	): FinancialTransaction | undefined {
		const update = this.database.transaction(() => {
			const existing = this.database
				.query('SELECT * FROM transactions WHERE book_id = ? AND id = ?')
				.get(bookId, id) as null | TransactionRow;
			if (!existing) {
				return;
			}
			const nextAccountId = input.accountId ?? existing.account_id;
			const nextAmount = input.amountMinor ?? existing.amount_minor;
			const nextDate = input.transactionDate ?? existing.transaction_date;
			const isChangesBalances =
				nextAccountId !== existing.account_id ||
				nextAmount !== existing.amount_minor ||
				nextDate !== existing.transaction_date ||
				input.parts !== undefined;
			if (isChangesBalances && existing.status === 'reconciled') {
				throw new Error(
					'Reconciled transactions must be unreconciled before changing their date, account, amount, or splits'
				);
			}

			if (existing.transfer_id !== null && (input.accountId !== undefined || input.parts !== undefined)) {
				throw new Error('Transfer accounts and splits cannot be changed independently');
			}
			if (
				existing.transfer_id !== null &&
				(nextAmount !== existing.amount_minor || nextDate !== existing.transaction_date)
			) {
				const peer = this.database
					.query('SELECT * FROM transactions WHERE book_id = ? AND transfer_id = ? AND id != ?')
					.get(bookId, existing.transfer_id, id) as null | TransactionRow;
				if (!peer || peer.status === 'reconciled') {
					throw new Error(
						'The reconciled transfer leg must be unreconciled before changing the transfer amount or date'
					);
				}
				if (nextAmount === 0 || Math.sign(nextAmount) !== Math.sign(existing.amount_minor)) {
					throw new Error('Transfer amount must retain the leg direction and remain greater than zero');
				}
				this.database
					.query(
						'UPDATE transactions SET amount_minor = ?, transaction_date = ? WHERE book_id = ? AND id = ?'
					)
					.run(-nextAmount, nextDate, bookId, peer.id);
				this.database
					.query('UPDATE transfers SET amount_minor = ?, transaction_date = ? WHERE book_id = ? AND id = ?')
					.run(Math.abs(nextAmount), nextDate, bookId, existing.transfer_id);
			}

			this.database
				.query(
					`
					UPDATE transactions SET account_id = ?, transaction_date = ?, payee = ?, memo = ?, amount_minor = ?
					WHERE book_id = ? AND id = ?
				`
				)
				.run(
					nextAccountId,
					nextDate,
					input.payee?.trim() ?? existing.payee,
					input.memo?.trim() ?? existing.memo,
					nextAmount,
					bookId,
					id
				);

			if (input.parts !== undefined) {
				this.database
					.query('DELETE FROM transaction_parts WHERE book_id = ? AND transaction_id = ?')
					.run(bookId, id);
				for (const [position, part] of input.parts.entries()) {
					this.database
						.query(
							`
						INSERT INTO transaction_parts (id, book_id, transaction_id, category_id, class_id, amount_minor, memo, position)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?)
					`
						)
						.run(
							randomUUID(),
							bookId,
							id,
							part.categoryId ?? JSON_NULL,
							part.classId ?? JSON_NULL,
							part.amountMinor,
							part.memo?.trim() ?? '',
							position
						);
				}
			}

			return this.find(bookId, id);
		});

		return update();
	}

	private readParts(bookId: string, transactionId: string): TransactionPart[] {
		const rows = this.database
			.query('SELECT * FROM transaction_parts WHERE book_id = ? AND transaction_id = ? ORDER BY position, id')
			.all(bookId, transactionId) as PartRow[];

		return rows.map(row => ({
			amountMinor: row.amount_minor,
			categoryId: row.category_id,
			classId: row.class_id,
			id: row.id,
			memo: row.memo,
		}));
	}
}

export { SqliteLedgerRepository };
