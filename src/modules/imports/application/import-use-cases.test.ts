import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { CloseAccount } from '@modules/accounts/application';
import { SqliteAccountRepository } from '@modules/accounts/infrastructure';
import { ArchiveBook, CreateBook, EnsureDefaultBook } from '@modules/books/application';
import { SqliteBookRepository } from '@modules/books/infrastructure';
import type { ImportFormat } from '@modules/imports/domain';
import { DEFAULT_IMPORT_LIMITS, ImportError } from '@modules/imports/domain';
import { PAYEE_CSV, QIF_BASIC, STATEMENT_CSV, toUtf8, toWindows1252 } from '@modules/imports/fixtures';
import { SqliteStatementImportRepository } from '@modules/imports/infrastructure';
import type { LedgerRepository } from '@modules/ledger/domain';
import { SqliteLedgerRepository } from '@modules/ledger/infrastructure';
import { migrateDatabase } from '@modules/storage/infrastructure';
import { Database } from 'bun:sqlite';
import { afterEach, describe, expect, it } from 'bun:test';

import type { ImportDependencies } from '.';
import { CommitStatementImport, PreviewStatementImport } from '.';

interface SetupOptions {
	currencyCode?: string;
	limits?: ImportDependencies['limits'];
	wrapLedger?: (ledger: LedgerRepository) => LedgerRepository;
}

function setup(options: SetupOptions = {}) {
	const database = new Database(':memory:');
	migrateDatabase(database);
	const books = new SqliteBookRepository(database);
	new EnsureDefaultBook(books).execute();
	const book = new CreateBook(books).execute({ currencyCode: options.currencyCode ?? 'EUR', name: 'Travel' });
	const other = new CreateBook(books).execute({ currencyCode: 'EUR', name: 'Other' });
	database
		.query(
			`INSERT INTO accounts (id, book_id, name, kind, opening_balance_minor) VALUES
			('cash', ?, 'Cash', 'checking', 0), ('foreign', ?, 'Foreign', 'checking', 0)`
		)
		.run(book.id, other.id);
	const accounts = new SqliteAccountRepository(database);
	const imports = new SqliteStatementImportRepository(database);
	const ledger = options.wrapLedger
		? options.wrapLedger(new SqliteLedgerRepository(database))
		: new SqliteLedgerRepository(database);
	const dependencies: ImportDependencies = {
		accounts,
		books,
		imports,
		...(options.limits && { limits: options.limits }),
	};

	return {
		accounts,
		book,
		books,
		commit: new CommitStatementImport({ ...dependencies, ledger }),
		count: (table: string) =>
			(database.query(`SELECT COUNT(*) AS total FROM ${table}`).get() as { total: number }).total,
		database,
		other,
		preview: new PreviewStatementImport(dependencies),
	};
}

function request(bookId: string, format: ImportFormat, content: Uint8Array, accountId = 'cash') {
	return { accountId, bookId, content, format };
}

function failure(work: () => unknown): ImportError {
	try {
		work();
	} catch (error) {
		if (error instanceof ImportError) {
			return error;
		}
		throw error;
	}
	throw new Error('Expected an ImportError');
}

describe('preview', () => {
	it('summarises a QIF file without writing anything', () => {
		const { book, count, preview } = setup();
		const result = preview.execute(request(book.id, 'qif', toUtf8(QIF_BASIC)));
		expect(result.canCommit).toBe(true);
		expect(result.currencyCode).toBe('EUR');
		expect(result.rows.map(row => [row.transactionDate, row.amountMinor, row.payee, row.memo])).toEqual([
			['2024-01-05', -1250, 'Café Demo', 'Lunch'],
			['2024-01-06', 123_456, 'Employer Demo', ''],
		]);
		expect(result.summary).toEqual({
			firstDate: '2024-01-05',
			lastDate: '2024-01-06',
			rowCount: 2,
			totalMinor: 122_206,
		});
		expect(result.ignoredFields).toEqual({ category: 1, number: 1 });
		expect(count('transactions')).toBe(0);
		expect(count('transaction_parts')).toBe(0);
		expect(count('statement_imports')).toBe(0);
	});

	it('reports row errors with line numbers and blocks the commit', () => {
		const { book, preview } = setup();
		const text = 'date,amount,payee,memo\n2024-13-01,1,A,\n2024-01-01,abc,B,\n2024-01-02,1.001,C,\n';
		const result = preview.execute(request(book.id, 'statement_csv', toUtf8(text)));
		expect(result.canCommit).toBe(false);
		expect(result.errorCount).toBe(3);
		expect(result.issues.map(item => [item.code, item.line])).toEqual([
			['invalid-date', 2],
			['invalid-amount', 3],
			['invalid-amount', 4],
		]);
	});

	it('respects currency fraction digits', () => {
		const jpy = setup({ currencyCode: 'JPY' });
		const yen = jpy.preview.execute(
			request(
				jpy.book.id,
				'statement_csv',
				toUtf8('date,amount,payee,memo\n2024-01-01,100,A,\n2024-01-01,1.5,B,\n')
			)
		);
		expect(yen.rows.map(row => row.amountMinor)).toEqual([100]);
		expect(yen.issues.map(item => item.code)).toEqual(['invalid-amount']);

		const kwd = setup({ currencyCode: 'KWD' });
		const dinar = kwd.preview.execute(
			request(kwd.book.id, 'statement_csv', toUtf8('date,amount,payee,memo\n2024-01-01,1.234,A,\n'))
		);
		expect(dinar.rows.map(row => row.amountMinor)).toEqual([1234]);
	});

	it('decodes a Windows-1252 QIF file and rejects the same bytes as a statement CSV', () => {
		const { book, preview } = setup();
		const result = preview.execute(request(book.id, 'qif', toWindows1252(QIF_BASIC)));
		expect(result.rows[0]?.payee).toBe('Café Demo');
		const csv = toWindows1252(STATEMENT_CSV.replace('Streaming', 'Streamíng'));
		expect(failure(() => preview.execute(request(book.id, 'statement_csv', csv))).code).toBe(
			'unsupported-encoding'
		);
	});

	it('canonicalises payees through an optional payee directory', () => {
		const { book, preview } = setup();
		const text = 'date,amount,payee,memo\n2024-01-01,-1.00,cafe demo,\n2024-01-02,-2.00,Unknown,\n';
		const result = preview.execute({
			...request(book.id, 'statement_csv', toUtf8(text)),
			payeeDirectory: toUtf8(PAYEE_CSV),
		});
		expect(result.rows.map(row => row.payee)).toEqual(['Café Demo', 'Unknown']);
		expect(result.payeesNormalized).toBe(1);
		expect(result.payeeDirectory).toEqual([]);
	});

	it('previews a payee file as a directory that cannot be committed', () => {
		const { book, commit, count, preview } = setup();
		const result = preview.execute(request(book.id, 'payee_csv', toUtf8(PAYEE_CSV)));
		expect(result.canCommit).toBe(false);
		expect(result.rows).toEqual([]);
		expect(result.payeeDirectory).toHaveLength(2);
		expect(failure(() => commit.execute(request(book.id, 'payee_csv', toUtf8(PAYEE_CSV)))).code).toBe(
			'payee-directory-not-persistable'
		);
		expect(count('statement_imports')).toBe(0);
	});

	it('warns about transactions that already exist without blocking', () => {
		const { book, commit, preview } = setup();
		commit.execute(request(book.id, 'qif', toUtf8(QIF_BASIC)));
		const again = toUtf8(`${QIF_BASIC}\n`);
		const result = preview.execute(request(book.id, 'qif', again));
		expect(result.existingImport).toBeNull();
		expect(result.warningCount).toBe(2);
		expect(result.rows.every(row => row.possibleDuplicate)).toBe(true);
		expect(result.canCommit).toBe(true);
	});
});

describe('book and account selection', () => {
	it('rejects unknown, archived and mismatched selections with typed errors', () => {
		const { accounts, book, books, other, preview } = setup();
		const content = toUtf8(QIF_BASIC);
		expect(failure(() => preview.execute(request('missing', 'qif', content))).code).toBe('book-not-found');
		expect(failure(() => preview.execute(request(book.id, 'qif', content, 'nope'))).code).toBe('account-not-found');
		expect(failure(() => preview.execute(request(book.id, 'qif', content, 'foreign'))).code).toBe(
			'account-not-found'
		);
		new CloseAccount(accounts).execute(book.id, 'cash');
		expect(failure(() => preview.execute(request(book.id, 'qif', content))).code).toBe('account-closed');
		new ArchiveBook(books).execute(other.id);
		expect(failure(() => preview.execute(request(other.id, 'qif', content, 'foreign'))).code).toBe('book-archived');
	});

	it('exposes an actionable message on every error', () => {
		const { preview } = setup();
		const error = failure(() => preview.execute(request('missing', 'qif', toUtf8(QIF_BASIC))));
		expect(error.action.length).toBeGreaterThan(0);
		expect(error.message.length).toBeGreaterThan(0);
	});
});

describe('limits', () => {
	it('rejects oversized and empty files before parsing', () => {
		const { book, preview } = setup();
		const big = new Uint8Array(DEFAULT_IMPORT_LIMITS.maxBytes + 1).fill(0x41);
		expect(failure(() => preview.execute(request(book.id, 'qif', big))).code).toBe('file-too-large');
		expect(failure(() => preview.execute(request(book.id, 'qif', new Uint8Array(0)))).code).toBe('empty-file');
	});

	it('caps the byte and record counts with overrides', () => {
		const small = setup({ limits: { maxBytes: 20 } });
		expect(failure(() => small.preview.execute(request(small.book.id, 'qif', toUtf8(QIF_BASIC)))).code).toBe(
			'file-too-large'
		);
		const few = setup({ limits: { maxRecords: 1 } });
		expect(failure(() => few.preview.execute(request(few.book.id, 'qif', toUtf8(QIF_BASIC)))).code).toBe(
			'too-many-records'
		);
	});

	it('caps the number of reported issues but keeps the totals', () => {
		const { book, preview } = setup({ limits: { maxReportedIssues: 2 } });
		const rows = Array.from({ length: 5 }, () => '2024-01-01,abc,A,').join('\n');
		const result = preview.execute(request(book.id, 'statement_csv', toUtf8(`date,amount,payee,memo\n${rows}\n`)));
		expect(result.issues).toHaveLength(2);
		expect(result.errorCount).toBe(5);
	});
});

describe('commit', () => {
	it('imports every row once and is idempotent on retry', () => {
		const { book, commit, count, database } = setup();
		const first = commit.execute(request(book.id, 'qif', toUtf8(QIF_BASIC)));
		expect(first.status).toBe('imported');
		expect(first.transactionIds).toHaveLength(2);
		expect(count('transactions')).toBe(2);
		expect(count('statement_imports')).toBe(1);

		const retry = commit.execute(request(book.id, 'qif', toUtf8(QIF_BASIC)));
		expect(retry.status).toBe('already-imported');
		expect(retry.importId).toBe(first.importId);
		expect(retry.transactionIds).toEqual([]);
		expect(count('transactions')).toBe(2);
		expect(count('statement_imports')).toBe(1);

		const stored = database
			.query('SELECT payee, amount_minor, status FROM transactions ORDER BY transaction_date')
			.all();
		expect(stored).toEqual([
			{ amount_minor: -1250, payee: 'Café Demo', status: 'uncleared' },
			{ amount_minor: 123_456, payee: 'Employer Demo', status: 'uncleared' },
		]);
	});

	it('shows the existing import in a later preview', () => {
		const { book, commit, preview } = setup();
		const done = commit.execute(request(book.id, 'statement_csv', toUtf8(STATEMENT_CSV)));
		const result = preview.execute(request(book.id, 'statement_csv', toUtf8(STATEMENT_CSV)));
		expect(result.existingImport?.id).toBe(done.importId);
		expect(result.canCommit).toBe(false);
	});

	it('rejects the whole file when any row is invalid and writes nothing', () => {
		const { book, commit, count } = setup();
		const text = 'date,amount,payee,memo\n2024-01-01,1.00,A,\n2024-01-02,x,B,\n';
		const error = failure(() => commit.execute(request(book.id, 'statement_csv', toUtf8(text))));
		expect(error.code).toBe('invalid-rows');
		expect(error.issues[0]?.line).toBe(3);
		expect(count('transactions')).toBe(0);
		expect(count('statement_imports')).toBe(0);
	});

	it('rejects a file without transactions', () => {
		const { book, commit } = setup();
		expect(
			failure(() => commit.execute(request(book.id, 'statement_csv', toUtf8('date,amount,payee,memo\n')))).code
		).toBe('no-rows');
	});

	it('rolls everything back when the ledger fails midway', () => {
		let calls = 0;
		const { book, commit, count } = setup({
			wrapLedger: ledger => ({
				...ledger,
				create: input => {
					calls++;
					if (calls === 2) {
						throw new Error('disk full');
					}

					return ledger.create(input);
				},
			}),
		});
		const error = failure(() => commit.execute(request(book.id, 'qif', toUtf8(QIF_BASIC))));
		expect(error.code).toBe('commit-failed');
		expect(error.line).toBe(9);
		expect(count('transactions')).toBe(0);
		expect(count('transaction_parts')).toBe(0);
		expect(count('statement_imports')).toBe(0);
	});

	it('treats the same bytes in another account as a separate import', () => {
		const { book, commit, count, database } = setup();
		database
			.query(
				`INSERT INTO accounts (id, book_id, name, kind, opening_balance_minor) VALUES ('second', ?, 'Second', 'checking', 0)`
			)
			.run(book.id);
		commit.execute(request(book.id, 'statement_csv', toUtf8(STATEMENT_CSV)));
		const result = commit.execute(request(book.id, 'statement_csv', toUtf8(STATEMENT_CSV), 'second'));
		expect(result.status).toBe('imported');
		expect(count('statement_imports')).toBe(2);
	});
});

describe('no network', () => {
	const original = fetch;
	afterEach(() => {
		Object.defineProperty(globalThis, 'fetch', { configurable: true, value: original, writable: true });
	});

	it('never calls fetch during preview or commit', () => {
		let calls = 0;
		Object.defineProperty(globalThis, 'fetch', {
			configurable: true,
			value: () => {
				calls++;
				throw new Error('network is forbidden');
			},
			writable: true,
		});
		const { book, commit, preview } = setup();
		preview.execute(request(book.id, 'qif', toUtf8(QIF_BASIC)));
		commit.execute(request(book.id, 'qif', toUtf8(QIF_BASIC)));
		expect(calls).toBe(0);
	});

	it('contains no network primitives in the module sources', () => {
		const root = path.join(import.meta.dir, '..');
		const sources: string[] = [];
		const walk = (directory: string) => {
			for (const name of readdirSync(directory)) {
				const filePath = path.join(directory, name);
				if (statSync(filePath).isDirectory()) {
					walk(filePath);
				} else if (filePath.endsWith('.ts') && !filePath.endsWith('.test.ts')) {
					sources.push(readFileSync(filePath, 'utf8'));
				}
			}
		};
		walk(root);
		expect(sources.length).toBeGreaterThan(5);
		for (const source of sources) {
			expect(source).not.toMatch(/fetch\(|node:https?|node:net|node:dgram|Bun\.connect|WebSocket|XMLHttpRequest/);
		}
	});
});
