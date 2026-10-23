import type { Database } from 'bun:sqlite';

import type {
	SharedExpense,
	SharedExpenseActor,
	SharedExpenseRepository,
	SharedExpenseSettlementStatus,
} from '../../domain';
import { SharedExpenseParticipant } from '../../domain';

interface ExpenseRow {
	actor_id: null | string;
	actor_kind: SharedExpenseActor['kind'];
	amount_minor: number;
	book_id: string;
	closed_at: null | string;
	created_at: string;
	description: string;
	id: string;
}

interface AllocationRow {
	amount_minor: number;
	participant_id: string;
	participant_name: string;
}

interface SettlementRow {
	amount_minor: number;
	participant_id: string;
	settled_at: null | string;
	settled_by_actor_id: null | string;
	settled_by_actor_kind: null | SharedExpenseActor['kind'];
	status: SharedExpenseSettlementStatus;
}

interface ParticipantRow {
	book_id: string;
	created_at: string;
	id: string;
	name: string;
	removed_at: null | string;
}

function sqlNullIfAbsent(value: string | undefined): null | string {
	// eslint-disable-next-line unicorn/no-null -- SQLite uses SQL NULL for absent optional values.
	return value ?? null;
}

function actorId(actor: SharedExpenseActor | undefined): string | undefined {
	return actor && 'id' in actor ? actor.id : undefined;
}

function toActor(kind: SharedExpenseActor['kind'], id: null | string): SharedExpenseActor {
	if (kind === 'unknown') {
		return { kind };
	}
	if (id === null) {
		throw new Error('Home Assistant actor id is missing from shared expense');
	}

	return { id, kind };
}

function toParticipant(row: ParticipantRow): SharedExpenseParticipant {
	return SharedExpenseParticipant.restore({
		bookId: row.book_id,
		createdAt: row.created_at,
		id: row.id,
		name: row.name,
		...(row.removed_at !== null && { removedAt: row.removed_at }),
	});
}

function assertConsistent(expense: SharedExpense): void {
	if (!Number.isSafeInteger(expense.amountMinor) || expense.amountMinor <= 0) {
		throw new TypeError('Expense minor units must be a positive safe integer');
	}
	if (expense.allocations.length === 0 || expense.allocations.length !== expense.settlements.length) {
		throw new Error('Each shared expense allocation must have exactly one settlement');
	}

	const allocations = new Map<string, bigint>();
	let total = 0n;
	for (const allocation of expense.allocations) {
		if (!Number.isSafeInteger(allocation.amountMinor) || allocation.amountMinor < 0) {
			throw new TypeError('Allocation minor units must be a non-negative safe integer');
		}
		if (allocations.has(allocation.participantId)) {
			throw new Error('Shared expense participants must be unique');
		}
		allocations.set(allocation.participantId, BigInt(allocation.amountMinor));
		total += BigInt(allocation.amountMinor);
	}
	if (total !== BigInt(expense.amountMinor)) {
		throw new Error('Shared expense allocations must sum to the expense amount');
	}

	const settlementIds = new Set<string>();
	for (const settlement of expense.settlements) {
		if (
			settlementIds.has(settlement.participantId) ||
			allocations.get(settlement.participantId) !== BigInt(settlement.amountMinor)
		) {
			throw new Error('Each settlement must match its participant allocation');
		}
		settlementIds.add(settlement.participantId);
	}
}

class SqliteSharedExpenseRepository implements SharedExpenseRepository {
	constructor(private readonly database: Database) {}

	close(bookId: string, id: string, closedAt: string): boolean {
		return (
			this.database
				.query('UPDATE shared_expenses SET closed_at = ? WHERE book_id = ? AND id = ? AND closed_at IS NULL')
				.run(closedAt, bookId, id).changes > 0
		);
	}

	create(expense: SharedExpense): SharedExpense {
		assertConsistent(expense);
		const insert = this.database.transaction(() => {
			this.database
				.query(
					`INSERT INTO shared_expenses
						(book_id, id, description, amount_minor, actor_kind, actor_id, created_at, closed_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
				)
				.run(
					expense.bookId,
					expense.id,
					expense.description,
					expense.amountMinor,
					expense.actor.kind,
					sqlNullIfAbsent('id' in expense.actor ? expense.actor.id : undefined),
					expense.createdAt,
					sqlNullIfAbsent(expense.closedAt)
				);

			const insertAllocation = this.database.query(
				`INSERT INTO shared_expense_allocations
					(book_id, expense_id, participant_id, participant_name, amount_minor, position)
				VALUES (?, ?, ?, ?, ?, ?)`
			);
			const insertSettlement = this.database.query(
				`INSERT INTO shared_expense_settlements
					(book_id, expense_id, participant_id, amount_minor, status, settled_at,
					settled_by_actor_kind, settled_by_actor_id)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
			);

			for (const [position, allocation] of expense.allocations.entries()) {
				insertAllocation.run(
					expense.bookId,
					expense.id,
					allocation.participantId,
					allocation.participantName,
					allocation.amountMinor,
					position
				);
				const settlement = expense.settlements.find(
					candidate => candidate.participantId === allocation.participantId
				);
				if (!settlement) {
					throw new Error('Shared expense settlement is missing');
				}
				insertSettlement.run(
					expense.bookId,
					expense.id,
					settlement.participantId,
					settlement.amountMinor,
					settlement.status,
					sqlNullIfAbsent(settlement.settledAt),
					sqlNullIfAbsent(settlement.settledByActor?.kind),
					sqlNullIfAbsent(actorId(settlement.settledByActor))
				);
			}

			const created = this.find(expense.bookId, expense.id);
			if (!created) {
				throw new Error('Created shared expense could not be read');
			}

			return created;
		});

		return insert();
	}

	createParticipant(participant: SharedExpenseParticipant): void {
		this.database
			.query(
				'INSERT INTO shared_expense_participants (book_id, id, name, created_at, removed_at) VALUES (?, ?, ?, ?, ?)'
			)
			.run(
				participant.bookId,
				participant.id,
				participant.name,
				participant.createdAt,
				sqlNullIfAbsent(participant.removedAt)
			);
	}

	find(bookId: string, id: string): SharedExpense | undefined {
		const row = this.database
			.query('SELECT * FROM shared_expenses WHERE book_id = ? AND id = ?')
			.get(bookId, id) as ExpenseRow | null;

		return row ? this.toExpense(row) : undefined;
	}

	findParticipant(bookId: string, id: string): SharedExpenseParticipant | undefined {
		const row = this.database
			.query('SELECT * FROM shared_expense_participants WHERE book_id = ? AND id = ?')
			.get(bookId, id) as null | ParticipantRow;

		return row ? toParticipant(row) : undefined;
	}

	list(bookId: string, options: { includeClosed?: boolean } = {}): SharedExpense[] {
		const closedFilter = options.includeClosed ? '' : 'AND closed_at IS NULL';
		const rows = this.database
			.query(`SELECT * FROM shared_expenses WHERE book_id = ? ${closedFilter} ORDER BY created_at DESC, id`)
			.all(bookId) as ExpenseRow[];

		return rows.map(row => this.toExpense(row));
	}

	listParticipants(bookId: string, options: { includeRemoved?: boolean } = {}): SharedExpenseParticipant[] {
		const removedFilter = options.includeRemoved ? '' : 'AND removed_at IS NULL';
		const rows = this.database
			.query(
				`SELECT * FROM shared_expense_participants WHERE book_id = ? ${removedFilter} ORDER BY name COLLATE NOCASE, id`
			)
			.all(bookId) as ParticipantRow[];

		return rows.map(row => toParticipant(row));
	}

	removeParticipant(bookId: string, id: string, removedAt: string): boolean {
		return (
			this.database
				.query(
					'UPDATE shared_expense_participants SET removed_at = ? WHERE book_id = ? AND id = ? AND removed_at IS NULL'
				)
				.run(removedAt, bookId, id).changes > 0
		);
	}

	reopen(bookId: string, id: string): boolean {
		return (
			this.database
				.query(
					'UPDATE shared_expenses SET closed_at = NULL WHERE book_id = ? AND id = ? AND closed_at IS NOT NULL'
				)
				.run(bookId, id).changes > 0
		);
	}

	settle(
		bookId: string,
		expenseId: string,
		participantId: string,
		actor: SharedExpenseActor,
		settledAt: string
	): boolean {
		return (
			this.database
				.query(
					`UPDATE shared_expense_settlements
				SET status = 'settled', settled_at = ?, settled_by_actor_kind = ?, settled_by_actor_id = ?
				WHERE book_id = ? AND expense_id = ? AND participant_id = ? AND status = 'pending'
				AND EXISTS (
					SELECT 1 FROM shared_expenses
					WHERE shared_expenses.book_id = ? AND shared_expenses.id = ? AND shared_expenses.closed_at IS NULL
				)`
				)
				.run(
					settledAt,
					actor.kind,
					sqlNullIfAbsent('id' in actor ? actor.id : undefined),
					bookId,
					expenseId,
					participantId,
					bookId,
					expenseId
				).changes > 0
		);
	}

	private toExpense(row: ExpenseRow): SharedExpense {
		const allocations = this.database
			.query(
				`SELECT participant_id, participant_name, amount_minor
				FROM shared_expense_allocations WHERE book_id = ? AND expense_id = ? ORDER BY position`
			)
			.all(row.book_id, row.id) as AllocationRow[];
		const settlements = this.database
			.query(
				`SELECT participant_id, amount_minor, status, settled_at,
					settled_by_actor_kind, settled_by_actor_id
				FROM shared_expense_settlements WHERE book_id = ? AND expense_id = ?
				ORDER BY participant_id`
			)
			.all(row.book_id, row.id) as SettlementRow[];

		return {
			actor: toActor(row.actor_kind, row.actor_id),
			allocations: allocations.map(allocation => ({
				amountMinor: allocation.amount_minor,
				participantId: allocation.participant_id,
				participantName: allocation.participant_name,
			})),
			amountMinor: row.amount_minor,
			bookId: row.book_id,
			...(row.closed_at !== null && { closedAt: row.closed_at }),
			createdAt: row.created_at,
			description: row.description,
			id: row.id,
			settlements: settlements.map(settlement => ({
				amountMinor: settlement.amount_minor,
				participantId: settlement.participant_id,
				...(settlement.settled_at !== null && { settledAt: settlement.settled_at }),
				...(settlement.settled_by_actor_kind !== null && {
					settledByActor: toActor(settlement.settled_by_actor_kind, settlement.settled_by_actor_id),
				}),
				status: settlement.status,
			})),
		};
	}
}

export { SqliteSharedExpenseRepository };
