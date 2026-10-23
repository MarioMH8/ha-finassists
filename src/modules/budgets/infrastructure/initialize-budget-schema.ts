import type { Database } from 'bun:sqlite';

function initializeBudgetSchema(database: Database): void {
	database.run('PRAGMA foreign_keys = ON');
	const initialize = database.transaction(() => {
		database.run(`
			CREATE TABLE IF NOT EXISTS budgets (
				id TEXT PRIMARY KEY,
				book_id TEXT NOT NULL,
				account_id TEXT NOT NULL,
				category_id TEXT,
				class_id TEXT,
				name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
				period_start TEXT NOT NULL CHECK (length(period_start) = 10),
				period_end TEXT NOT NULL CHECK (length(period_end) = 10),
				planned_minor INTEGER NOT NULL CHECK (
					typeof(planned_minor) = 'integer' AND planned_minor BETWEEN 0 AND 9007199254740991
				),
				currency_code TEXT NOT NULL CHECK (length(currency_code) = 3),
				CHECK (period_start <= period_end),
				UNIQUE (book_id, id),
				FOREIGN KEY (book_id, account_id) REFERENCES accounts(book_id, id) ON DELETE RESTRICT,
				FOREIGN KEY (book_id, category_id) REFERENCES categories(book_id, id) ON DELETE RESTRICT,
				FOREIGN KEY (book_id, class_id) REFERENCES classes(book_id, id) ON DELETE RESTRICT,
				FOREIGN KEY (book_id, currency_code) REFERENCES books(id, currency_code) ON DELETE RESTRICT
			)
		`);
		database.run(
			'CREATE INDEX IF NOT EXISTS budgets_book_account_period_index ON budgets(book_id, account_id, period_start, period_end, id)'
		);
		database.run(`
			CREATE TRIGGER IF NOT EXISTS budgets_no_overlapping_periods_insert
			BEFORE INSERT ON budgets
			WHEN EXISTS (
				SELECT 1 FROM budgets existing
				WHERE existing.book_id = NEW.book_id
					AND existing.account_id = NEW.account_id
					AND existing.category_id IS NEW.category_id
					AND existing.class_id IS NEW.class_id
					AND existing.period_start <= NEW.period_end
					AND existing.period_end >= NEW.period_start
			)
			BEGIN
				SELECT RAISE(ABORT, 'budget_period_overlap');
			END
		`);
		database.run(`
			CREATE TRIGGER IF NOT EXISTS budgets_no_overlapping_periods_update
			BEFORE UPDATE OF book_id, account_id, category_id, class_id, period_start, period_end ON budgets
			WHEN EXISTS (
				SELECT 1 FROM budgets existing
				WHERE existing.id != OLD.id
					AND existing.book_id = NEW.book_id
					AND existing.account_id = NEW.account_id
					AND existing.category_id IS NEW.category_id
					AND existing.class_id IS NEW.class_id
					AND existing.period_start <= NEW.period_end
					AND existing.period_end >= NEW.period_start
			)
			BEGIN
				SELECT RAISE(ABORT, 'budget_period_overlap');
			END
		`);
	});
	initialize();
}

export { initializeBudgetSchema };
