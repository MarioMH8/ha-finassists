import { CreateBook, EnsureDefaultBook } from '@modules/books/application';
import { SqliteBookRepository } from '@modules/books/infrastructure';
import { migrateDatabase } from '@modules/storage/infrastructure';
import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';

import {
	CreateTransaction,
	CreateTransfer,
	DeleteTransaction,
	SetTransactionStatus,
	UpdateTransaction,
} from '../../application';
import { FinancialTransaction } from '../../domain';
import { SqliteLedgerRepository } from './sqlite-ledger.repository';

const JSON_NULL = JSON.parse('null') as null;

describe('ledger use cases', () => {
	function setup() {
		const database = new Database(':memory:');
		migrateDatabase(database);
		const books = new SqliteBookRepository(database);
		new EnsureDefaultBook(books).execute();
		const book = new CreateBook(books).execute({ currencyCode: 'EUR', name: 'Travel' });
		database
			.query(
				`INSERT INTO accounts (id, book_id, name, kind, opening_balance_minor) VALUES
			('cash', ?, 'Cash', 'checking', 0), ('savings', ?, 'Savings', 'savings', 0)`
			)
			.run(book.id, book.id);
		const repository = new SqliteLedgerRepository(database);

		return { book, database, repository };
	}

	it('persists split transactions with exact amounts and actor attribution', () => {
		const { book, database, repository } = setup();
		const transaction = new CreateTransaction(repository).execute({
			accountId: 'cash',
			actorId: 'user-1',
			amountMinor: -1250,
			bookId: book.id,
			memo: 'Lunch',
			parts: [
				{ amountMinor: -1000, categoryId: JSON_NULL },
				{ amountMinor: -250, memo: 'Coffee' },
			],
			payee: 'Cafe',
			transactionDate: '2026-03-01',
		});

		expect(transaction).toMatchObject({ actorId: 'user-1', amountMinor: -1250, status: 'uncleared' });
		expect(transaction.parts.map(part => part.amountMinor)).toEqual([-1000, -250]);
		expect(
			database
				.query('SELECT position FROM transaction_parts WHERE transaction_id = ? ORDER BY position')
				.all(transaction.id)
		).toEqual([{ position: 0 }, { position: 1 }]);
		const restored = new SqliteLedgerRepository(database).find(book.id, transaction.id);
		expect(restored).toBeInstanceOf(FinancialTransaction);
		expect(restored).toEqual(transaction);
		database.close();
	});

	it('requires split amounts to conserve the parent and validates dates', () => {
		const { book, database, repository } = setup();
		const create = new CreateTransaction(repository);
		const base = { accountId: 'cash', amountMinor: -100, bookId: book.id, transactionDate: '2026-03-01' };

		expect(() => create.execute({ ...base, parts: [{ amountMinor: -99 }] })).toThrow('must sum');
		expect(() => create.execute({ ...base, transactionDate: '2026-02-30' })).toThrow('valid calendar date');
		database.close();
	});

	it('creates linked transfer legs and applies status changes independently', () => {
		const { book, database, repository } = setup();
		const transfer = new CreateTransfer(repository).execute({
			amountMinor: 4200,
			bookId: book.id,
			fromAccountId: 'cash',
			toAccountId: 'savings',
			transactionDate: '2026-03-01',
		});

		expect(transfer.from.amountMinor).toBe(-4200);
		expect(transfer.to.amountMinor).toBe(4200);
		expect(transfer.from.transferId).toBe(transfer.id);
		expect(transfer.to.transferId).toBe(transfer.id);
		expect(new Set([transfer.from.status, transfer.to.status])).toEqual(new Set(['uncleared']));
		const status = new SetTransactionStatus(repository);
		expect(status.execute(book.id, transfer.from.id, 'cleared')).toBe(true);
		expect(repository.find(book.id, transfer.from.id)?.status).toBe('cleared');
		expect(repository.find(book.id, transfer.to.id)?.status).toBe('uncleared');
		database.close();
	});

	it('updates entries and requires unreconciliation before balance-affecting corrections', () => {
		const { book, database, repository } = setup();
		const transaction = new CreateTransaction(repository).execute({
			accountId: 'cash',
			amountMinor: -100,
			bookId: book.id,
			parts: [{ amountMinor: -100 }],
			transactionDate: '2026-03-01',
		});
		const update = new UpdateTransaction(repository);
		expect(
			update.execute(book.id, transaction.id, { amountMinor: -125, memo: 'Corrected' })?.parts[0]?.amountMinor
		).toBe(-125);
		const status = new SetTransactionStatus(repository);
		expect(status.execute(book.id, transaction.id, 'reconciled')).toBe(true);
		expect(() => update.execute(book.id, transaction.id, { transactionDate: '2026-03-02' })).toThrow(
			'must be unreconciled'
		);
		expect(update.execute(book.id, transaction.id, { memo: 'Updated note' })?.memo).toBe('Updated note');
		expect(status.execute(book.id, transaction.id, 'cleared')).toBe(true);
		expect(update.execute(book.id, transaction.id, { transactionDate: '2026-03-02' })?.transactionDate).toBe(
			'2026-03-02'
		);
		database.close();
	});

	it('keeps linked transfer amounts and dates paired during correction', () => {
		const { book, database, repository } = setup();
		const transfer = new CreateTransfer(repository).execute({
			amountMinor: 100,
			bookId: book.id,
			fromAccountId: 'cash',
			toAccountId: 'savings',
			transactionDate: '2026-03-01',
		});
		const update = new UpdateTransaction(repository);
		const changed = update.execute(book.id, transfer.from.id, { amountMinor: -150, transactionDate: '2026-03-02' });
		expect(changed?.amountMinor).toBe(-150);
		expect(repository.find(book.id, transfer.to.id)).toMatchObject({
			amountMinor: 150,
			transactionDate: '2026-03-02',
		});
		database.close();
	});

	it('locks reconciled entries until explicitly unreconciled', () => {
		const { book, database, repository } = setup();
		const transaction = new CreateTransaction(repository).execute({
			accountId: 'cash',
			amountMinor: -100,
			bookId: book.id,
			transactionDate: '2026-03-01',
		});
		const status = new SetTransactionStatus(repository);
		const remove = new DeleteTransaction(repository);
		expect(status.execute(book.id, transaction.id, 'reconciled')).toBe(true);
		expect(remove.execute(book.id, transaction.id)).toBe(false);
		expect(status.execute(book.id, transaction.id, 'uncleared')).toBe(false);
		expect(status.execute(book.id, transaction.id, 'cleared')).toBe(true);
		expect(remove.execute(book.id, transaction.id)).toBe(true);
		database.close();
	});

	it('rejects transfers across books and deletes linked transfer legs together', () => {
		const { book, database, repository } = setup();
		const otherBook = new CreateBook(new SqliteBookRepository(database)).execute({
			currencyCode: 'EUR',
			name: 'Other',
		});
		const result = () =>
			new CreateTransfer(repository).execute({
				amountMinor: 100,
				bookId: otherBook.id,
				fromAccountId: 'cash',
				toAccountId: 'savings',
				transactionDate: '2026-03-01',
			});
		expect(() => result()).toThrow();
		const transfer = new CreateTransfer(repository).execute({
			amountMinor: 100,
			bookId: book.id,
			fromAccountId: 'cash',
			toAccountId: 'savings',
			transactionDate: '2026-03-01',
		});
		expect(new DeleteTransaction(repository).execute(book.id, transfer.from.id)).toBe(true);
		expect(repository.find(book.id, transfer.from.id)).toBeUndefined();
		expect(repository.find(book.id, transfer.to.id)).toBeUndefined();
		database.close();
	});
});
