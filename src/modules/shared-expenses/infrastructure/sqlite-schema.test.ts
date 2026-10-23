import { migrateDatabase } from '@modules/storage/infrastructure';
import { Database } from 'bun:sqlite';
import { afterEach, describe, expect, it } from 'bun:test';

import { initializeSharedExpenseSchema } from './sqlite-schema';

const databases: Database[] = [];

afterEach(() => {
	for (const database of databases) {
		database.close();
	}
	databases.length = 0;
});

describe('initializeSharedExpenseSchema', () => {
	it('preserves existing shared expenses and settlements when enabling integration actors', () => {
		const database = new Database(':memory:');
		databases.push(database);
		migrateDatabase(database);
		database.run('PRAGMA foreign_keys = ON');
		database
			.query('INSERT INTO books (id, name, currency_code, is_default) VALUES (?, ?, ?, ?)')
			.run('default', 'Default', 'USD', 1);
		database.run(`
			CREATE TABLE shared_expense_participants (
				book_id TEXT NOT NULL,
				id TEXT NOT NULL,
				name TEXT NOT NULL,
				created_at TEXT NOT NULL,
				removed_at TEXT,
				PRIMARY KEY (book_id, id),
				FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE RESTRICT
			)
		`);
		database.run(`
			CREATE TABLE shared_expenses (
				book_id TEXT NOT NULL,
				id TEXT NOT NULL,
				description TEXT NOT NULL,
				amount_minor INTEGER NOT NULL,
				actor_kind TEXT NOT NULL CHECK (actor_kind IN ('home_assistant_user', 'unknown')),
				actor_id TEXT,
				created_at TEXT NOT NULL,
				closed_at TEXT,
				PRIMARY KEY (book_id, id),
				CHECK ((actor_kind = 'unknown' AND actor_id IS NULL) OR (actor_kind = 'home_assistant_user' AND actor_id IS NOT NULL)),
				FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE RESTRICT
			)
		`);
		database.run(`
			CREATE TABLE shared_expense_allocations (
				book_id TEXT NOT NULL,
				expense_id TEXT NOT NULL,
				participant_id TEXT NOT NULL,
				participant_name TEXT NOT NULL,
				amount_minor INTEGER NOT NULL,
				position INTEGER NOT NULL,
				PRIMARY KEY (book_id, expense_id, participant_id),
				UNIQUE (book_id, expense_id, position),
				FOREIGN KEY (book_id, expense_id) REFERENCES shared_expenses(book_id, id) ON DELETE CASCADE,
				FOREIGN KEY (book_id, participant_id) REFERENCES shared_expense_participants(book_id, id) ON DELETE RESTRICT
			)
		`);
		database.run(`
			CREATE TABLE shared_expense_settlements (
				book_id TEXT NOT NULL,
				expense_id TEXT NOT NULL,
				participant_id TEXT NOT NULL,
				amount_minor INTEGER NOT NULL,
				status TEXT NOT NULL,
				settled_at TEXT,
				settled_by_actor_kind TEXT,
				settled_by_actor_id TEXT,
				PRIMARY KEY (book_id, expense_id, participant_id),
				FOREIGN KEY (book_id, expense_id, participant_id)
					REFERENCES shared_expense_allocations(book_id, expense_id, participant_id) ON DELETE CASCADE
			)
		`);
		database
			.query('INSERT INTO shared_expense_participants (book_id, id, name, created_at) VALUES (?, ?, ?, ?)')
			.run('default', 'person-1', 'Person One', '2025-01-01');
		database.run(`
			INSERT INTO shared_expenses
				(book_id, id, description, amount_minor, actor_kind, actor_id, created_at, closed_at)
			VALUES ('default', 'expense-1', 'Legacy dinner', 15, 'home_assistant_user', 'user-1', '2025-01-01', NULL)
		`);
		database.run(`
			INSERT INTO shared_expense_allocations
				(book_id, expense_id, participant_id, participant_name, amount_minor, position)
			VALUES ('default', 'expense-1', 'person-1', 'Person One', 15, 0)
		`);
		database.run(`
			INSERT INTO shared_expense_settlements
				(book_id, expense_id, participant_id, amount_minor, status, settled_at, settled_by_actor_kind, settled_by_actor_id)
			VALUES ('default', 'expense-1', 'person-1', 15, 'settled', '2025-01-02', 'home_assistant_user', 'user-2')
		`);

		initializeSharedExpenseSchema(database);

		const expense = database
			.query('SELECT description, actor_kind, actor_id FROM shared_expenses WHERE id = ?')
			.get('expense-1');
		const allocation = database
			.query(
				'SELECT participant_name, amount_minor, position FROM shared_expense_allocations WHERE expense_id = ?'
			)
			.get('expense-1');
		const settlement = database
			.query(
				'SELECT status, settled_at, settled_by_actor_kind, settled_by_actor_id FROM shared_expense_settlements WHERE expense_id = ?'
			)
			.get('expense-1');
		const integrationInsert = database.query(
			'INSERT INTO shared_expenses (book_id, id, description, amount_minor, actor_kind, actor_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
		);

		integrationInsert.run(
			'default',
			'expense-2',
			'Integration-created',
			3,
			'home_assistant_integration',
			'home-assistant-integration',
			'2025-01-03'
		);

		expect(expense).toEqual({
			actor_id: 'user-1',
			actor_kind: 'home_assistant_user',
			description: 'Legacy dinner',
		});
		expect(allocation).toEqual({ amount_minor: 15, participant_name: 'Person One', position: 0 });
		expect(settlement).toEqual({
			settled_at: '2025-01-02',
			settled_by_actor_id: 'user-2',
			settled_by_actor_kind: 'home_assistant_user',
			status: 'settled',
		});
		expect(database.query('PRAGMA foreign_key_check').all()).toEqual([]);
	});
});
