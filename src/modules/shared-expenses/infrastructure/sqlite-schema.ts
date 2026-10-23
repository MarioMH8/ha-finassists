import type { Database } from 'bun:sqlite';

interface ExpenseRow {
	actor_id: null | string;
	actor_kind: string;
	amount_minor: number;
	book_id: string;
	closed_at: null | string;
	created_at: string;
	description: string;
	id: string;
}

interface AllocationRow {
	amount_minor: number;
	book_id: string;
	expense_id: string;
	participant_id: string;
	participant_name: string;
	position: number;
}

interface SettlementRow {
	amount_minor: number;
	book_id: string;
	expense_id: string;
	participant_id: string;
	settled_at: null | string;
	settled_by_actor_id: null | string;
	settled_by_actor_kind: null | string;
	status: string;
}

function createSharedExpenseTables(database: Database): void {
	database.run(`
		CREATE TABLE IF NOT EXISTS shared_expenses (
			book_id TEXT NOT NULL,
			id TEXT NOT NULL,
			description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 200),
			amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
			actor_kind TEXT NOT NULL CHECK (actor_kind IN ('home_assistant_user', 'home_assistant_integration', 'unknown')),
			actor_id TEXT,
			created_at TEXT NOT NULL,
			closed_at TEXT,
			PRIMARY KEY (book_id, id),
			CHECK ((actor_kind = 'unknown' AND actor_id IS NULL) OR (actor_kind IN ('home_assistant_user', 'home_assistant_integration') AND actor_id IS NOT NULL)),
			FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE RESTRICT
		)
	`);
	database.run(
		'CREATE INDEX IF NOT EXISTS shared_expenses_book_date_index ON shared_expenses(book_id, closed_at, created_at DESC, id)'
	);
	database.run(`
		CREATE TABLE IF NOT EXISTS shared_expense_allocations (
			book_id TEXT NOT NULL,
			expense_id TEXT NOT NULL,
			participant_id TEXT NOT NULL,
			participant_name TEXT NOT NULL CHECK (length(trim(participant_name)) BETWEEN 1 AND 120),
			amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
			position INTEGER NOT NULL CHECK (position >= 0),
			PRIMARY KEY (book_id, expense_id, participant_id),
			UNIQUE (book_id, expense_id, position),
			FOREIGN KEY (book_id, expense_id) REFERENCES shared_expenses(book_id, id) ON DELETE CASCADE,
			FOREIGN KEY (book_id, participant_id) REFERENCES shared_expense_participants(book_id, id) ON DELETE RESTRICT
		)
	`);
	database.run(`
		CREATE TABLE IF NOT EXISTS shared_expense_settlements (
			book_id TEXT NOT NULL,
			expense_id TEXT NOT NULL,
			participant_id TEXT NOT NULL,
			amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
			status TEXT NOT NULL CHECK (status IN ('pending', 'settled')),
			settled_at TEXT,
			settled_by_actor_kind TEXT,
			settled_by_actor_id TEXT,
			PRIMARY KEY (book_id, expense_id, participant_id),
			CHECK (
				(status = 'pending' AND settled_at IS NULL AND settled_by_actor_kind IS NULL AND settled_by_actor_id IS NULL)
				OR (status = 'settled' AND settled_at IS NOT NULL AND settled_by_actor_kind IN ('home_assistant_user', 'home_assistant_integration', 'unknown')
					AND ((settled_by_actor_kind = 'unknown' AND settled_by_actor_id IS NULL)
						OR (settled_by_actor_kind IN ('home_assistant_user', 'home_assistant_integration') AND settled_by_actor_id IS NOT NULL)))
			),
			FOREIGN KEY (book_id, expense_id, participant_id)
				REFERENCES shared_expense_allocations(book_id, expense_id, participant_id) ON DELETE CASCADE
		)
	`);
}

function upgradeSharedExpenseActorConstraint(database: Database): void {
	const schema = database
		.query('SELECT sql FROM sqlite_master WHERE type = ? AND name = ?')
		.get('table', 'shared_expenses') as undefined | { sql: string };
	if (!schema || schema.sql.includes('home_assistant_integration')) {
		return;
	}

	const expenses = database.query('SELECT * FROM shared_expenses').all() as ExpenseRow[];
	const allocations = database.query('SELECT * FROM shared_expense_allocations').all() as AllocationRow[];
	const settlements = database.query('SELECT * FROM shared_expense_settlements').all() as SettlementRow[];
	const upgrade = database.transaction(() => {
		database.run('DROP TABLE shared_expense_settlements');
		database.run('DROP TABLE shared_expense_allocations');
		database.run('DROP TABLE shared_expenses');
		createSharedExpenseTables(database);

		const insertExpense = database.query(
			'INSERT INTO shared_expenses (book_id, id, description, amount_minor, actor_kind, actor_id, created_at, closed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
		);
		for (const expense of expenses) {
			insertExpense.run(
				expense.book_id,
				expense.id,
				expense.description,
				expense.amount_minor,
				expense.actor_kind,
				expense.actor_id,
				expense.created_at,
				expense.closed_at
			);
		}

		const insertAllocation = database.query(
			'INSERT INTO shared_expense_allocations (book_id, expense_id, participant_id, participant_name, amount_minor, position) VALUES (?, ?, ?, ?, ?, ?)'
		);
		for (const allocation of allocations) {
			insertAllocation.run(
				allocation.book_id,
				allocation.expense_id,
				allocation.participant_id,
				allocation.participant_name,
				allocation.amount_minor,
				allocation.position
			);
		}

		const insertSettlement = database.query(
			'INSERT INTO shared_expense_settlements (book_id, expense_id, participant_id, amount_minor, status, settled_at, settled_by_actor_kind, settled_by_actor_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
		);
		for (const settlement of settlements) {
			insertSettlement.run(
				settlement.book_id,
				settlement.expense_id,
				settlement.participant_id,
				settlement.amount_minor,
				settlement.status,
				settlement.settled_at,
				settlement.settled_by_actor_kind,
				settlement.settled_by_actor_id
			);
		}
	});
	upgrade();
}

function initializeSharedExpenseSchema(database: Database): void {
	database.run('PRAGMA foreign_keys = ON');
	database.run(`
		CREATE TABLE IF NOT EXISTS shared_expense_participants (
			book_id TEXT NOT NULL,
			id TEXT NOT NULL,
			name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
			created_at TEXT NOT NULL,
			removed_at TEXT,
			PRIMARY KEY (book_id, id),
			FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE RESTRICT
		)
	`);
	database.run(
		'CREATE INDEX IF NOT EXISTS shared_expense_participants_book_index ON shared_expense_participants(book_id, removed_at, name COLLATE NOCASE, id)'
	);
	upgradeSharedExpenseActorConstraint(database);
	createSharedExpenseTables(database);
}

export { initializeSharedExpenseSchema };
