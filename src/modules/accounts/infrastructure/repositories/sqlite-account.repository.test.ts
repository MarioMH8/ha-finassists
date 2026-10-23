import { ArchiveBook, CreateBook, EnsureDefaultBook } from '@modules/books/application';
import { SqliteBookRepository } from '@modules/books/infrastructure';
import { migrateDatabase } from '@modules/storage/infrastructure';
import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';

import { CloseAccount, CreateAccount, GetAccountBalances, ListAccounts, ReopenAccount } from '../../application';
import { AccountAsOfDateInvalidError, AccountBookArchivedError, AccountBookNotFoundError } from '../../domain';
import { SqliteAccountRepository } from './sqlite-account.repository';

type Status = 'cleared' | 'reconciled' | 'uncleared';

function setup() {
	const database = new Database(':memory:');
	migrateDatabase(database);
	const books = new SqliteBookRepository(database);
	const accounts = new SqliteAccountRepository(database);
	const defaultBook = new EnsureDefaultBook(books).execute();
	let sequence = 0;

	function addTransaction(bookId: string, accountId: string, date: string, amount: number, status: Status) {
		sequence += 1;
		database
			.query(
				'INSERT INTO transactions (id, book_id, account_id, transaction_date, amount_minor, status) VALUES (?, ?, ?, ?, ?, ?)'
			)
			.run(`tx-${String(sequence)}`, bookId, accountId, date, amount, status);
	}

	return {
		accounts,
		addTransaction,
		balances: new GetAccountBalances(accounts, books),
		books,
		close: new CloseAccount(accounts),
		create: new CreateAccount(accounts, books),
		database,
		defaultBook,
		list: new ListAccounts(accounts),
		reopen: new ReopenAccount(accounts),
	};
}

describe('account use cases', () => {
	it('creates accounts and lists them by name within one book', () => {
		const { create, database, defaultBook, list } = setup();
		const savings = create.execute({
			bookId: defaultBook.id,
			kind: 'savings',
			name: 'Zeta',
			openingBalanceMinor: 100,
		});
		const checking = create.execute({
			bookId: defaultBook.id,
			kind: 'checking',
			name: ' alpha ',
			openingBalanceMinor: -50,
		});

		expect(list.execute({ bookId: defaultBook.id })).toEqual([checking, savings]);
		expect(checking).toMatchObject({ bookId: defaultBook.id, name: 'alpha', openingBalanceMinor: -50 });
		database.close();
	});

	it('rejects invalid names, kinds, amounts and unknown or archived books', () => {
		const { books, create, database, defaultBook } = setup();
		const valid = { bookId: defaultBook.id, kind: 'checking', name: 'Main', openingBalanceMinor: 0 };

		expect(() => create.execute({ ...valid, name: ' ' })).toThrow('Account name');
		expect(() => create.execute({ ...valid, kind: 'cash' })).toThrow('Account kind');
		expect(() => create.execute({ ...valid, openingBalanceMinor: 0.5 })).toThrow('safe integer');
		expect(() => create.execute({ ...valid, openingBalanceMinor: Number.MAX_SAFE_INTEGER + 1 })).toThrow(
			'safe integer'
		);
		expect(() => create.execute({ ...valid, bookId: 'missing' })).toThrow(AccountBookNotFoundError);
		new ArchiveBook(books).execute(defaultBook.id);
		expect(() => create.execute(valid)).toThrow(AccountBookArchivedError);
		database.close();
	});

	it('closes and reopens accounts idempotently, hiding closed ones by default', () => {
		const { close, create, database, defaultBook, list, reopen } = setup();
		const account = create.execute({
			bookId: defaultBook.id,
			kind: 'checking',
			name: 'Main',
			openingBalanceMinor: 0,
		});

		expect(close.execute(defaultBook.id, account.id)).toBe(true);
		expect(close.execute(defaultBook.id, account.id)).toBe(false);
		expect(list.execute({ bookId: defaultBook.id })).toEqual([]);
		const [closed] = list.execute({ bookId: defaultBook.id, includeClosed: true });
		expect(closed.closedAt).toBeDefined();
		expect(reopen.execute(defaultBook.id, account.id)).toBe(true);
		expect(reopen.execute(defaultBook.id, account.id)).toBe(false);
		expect(list.execute({ bookId: defaultBook.id })).toEqual([account]);
		database.close();
	});

	it('keeps balances readable after an account is closed', () => {
		const { addTransaction, balances, close, create, database, defaultBook } = setup();
		const account = create.execute({
			bookId: defaultBook.id,
			kind: 'checking',
			name: 'Main',
			openingBalanceMinor: 1000,
		});
		addTransaction(defaultBook.id, account.id, '2026-01-01', -200, 'cleared');
		close.execute(defaultBook.id, account.id);

		expect(balances.execute({ bookId: defaultBook.id, id: account.id }).total.minorUnits).toBe(800);
		database.close();
	});

	it('does not close, reopen or read accounts through another book', () => {
		const { balances, books, close, create, database, defaultBook, list, reopen } = setup();
		const other = new CreateBook(books).execute({ currencyCode: 'USD', name: 'Other' });
		const account = create.execute({
			bookId: defaultBook.id,
			kind: 'checking',
			name: 'Main',
			openingBalanceMinor: 0,
		});

		expect(close.execute(other.id, account.id)).toBe(false);
		expect(reopen.execute(other.id, account.id)).toBe(false);
		expect(list.execute({ bookId: other.id, includeClosed: true })).toEqual([]);
		expect(() => balances.execute({ bookId: other.id, id: account.id })).toThrow('Account not found');
		expect(list.execute({ bookId: defaultBook.id })).toEqual([account]);
		database.close();
	});

	it('enforces book/account consistency in the schema', () => {
		const { database, defaultBook } = setup();

		expect(() =>
			database
				.query(
					`INSERT INTO transactions (id, book_id, account_id, transaction_date, amount_minor) VALUES ('t', ?, 'ghost', '2026-01-01', 1)`
				)
				.run(defaultBook.id)
		).toThrow();
		database.close();
	});
});

describe('account balances', () => {
	function seeded() {
		const context = setup();
		const account = context.create.execute({
			bookId: context.defaultBook.id,
			kind: 'checking',
			name: 'Main',
			openingBalanceMinor: 10_000,
		});
		const add = (date: string, amount: number, status: Status) =>
			context.addTransaction(context.defaultBook.id, account.id, date, amount, status);

		return { ...context, account, add };
	}

	it('returns the opening balance for an account without transactions', () => {
		const { account, balances, database, defaultBook } = seeded();
		const result = balances.execute({ bookId: defaultBook.id, id: account.id });

		expect([result.total, result.posted, result.reconciled].map(money => money.minorUnits)).toEqual([
			10_000, 10_000, 10_000,
		]);
		expect(result.total.currency.code).toBe('EUR');
		database.close();
	});

	it('separates uncleared, cleared and reconciled buckets with negative values', () => {
		const { account, add, balances, database, defaultBook } = seeded();
		add('2026-01-01', -1500, 'reconciled');
		add('2026-01-02', 400, 'reconciled');
		add('2026-01-03', -2500, 'cleared');
		add('2026-01-04', 700, 'cleared');
		add('2026-01-05', -300, 'uncleared');
		add('2026-01-06', 50, 'uncleared');

		const result = balances.execute({ bookId: defaultBook.id, id: account.id });

		expect(result.reconciled.minorUnits).toBe(8900);
		expect(result.posted.minorUnits).toBe(7100);
		expect(result.total.minorUnits).toBe(6850);
		database.close();
	});

	it('includes future-dated entries without an as-of filter and honours it when given', () => {
		const { account, add, balances, database, defaultBook } = seeded();
		add('2026-01-01', -100, 'cleared');
		add('2999-12-31', -1000, 'uncleared');
		add('2999-12-31', 500, 'reconciled');

		const all = balances.execute({ bookId: defaultBook.id, id: account.id });
		const past = balances.execute({ asOf: '2026-06-01', bookId: defaultBook.id, id: account.id });
		const boundary = balances.execute({ asOf: '2999-12-31', bookId: defaultBook.id, id: account.id });

		expect([all.total, all.posted, all.reconciled].map(money => money.minorUnits)).toEqual([9400, 10_400, 10_500]);
		expect([past.total, past.posted, past.reconciled].map(money => money.minorUnits)).toEqual([9900, 9900, 10_000]);
		expect(boundary.total.minorUnits).toBe(all.total.minorUnits);
		database.close();
	});

	it('ignores other accounts and rejects malformed as-of dates', () => {
		const { account, add, balances, create, database, defaultBook } = seeded();
		const other = create.execute({
			bookId: defaultBook.id,
			kind: 'savings',
			name: 'Other',
			openingBalanceMinor: 0,
		});
		add('2026-01-01', -100, 'cleared');

		expect(balances.execute({ bookId: defaultBook.id, id: other.id }).total.minorUnits).toBe(0);
		for (const asOf of ['2026-13-01', '2026-02-30', '2026/01/01', '']) {
			expect(() => balances.execute({ asOf, bookId: defaultBook.id, id: account.id })).toThrow(
				AccountAsOfDateInvalidError
			);
		}
		database.close();
	});

	it('does not count transactions from another book that reuses the account id', () => {
		const { account, addTransaction, balances, books, create, database, defaultBook } = seeded();
		const other = new CreateBook(books).execute({ currencyCode: 'USD', name: 'Other' });
		const twin = create.execute({ bookId: other.id, kind: 'checking', name: 'Main', openingBalanceMinor: 1 });
		addTransaction(other.id, twin.id, '2026-01-01', -999, 'cleared');

		expect(balances.execute({ bookId: defaultBook.id, id: account.id }).total.minorUnits).toBe(10_000);
		const result = balances.execute({ bookId: other.id, id: twin.id });
		expect(result.total.minorUnits).toBe(-998);
		expect(result.total.currency.code).toBe('USD');
		database.close();
	});

	it('rejects unsafe totals', () => {
		const { account, add, balances, database, defaultBook } = seeded();
		add('2026-01-01', Number.MAX_SAFE_INTEGER, 'cleared');

		expect(() => balances.execute({ bookId: defaultBook.id, id: account.id })).toThrow('safe integer');
		database.close();
	});
});
