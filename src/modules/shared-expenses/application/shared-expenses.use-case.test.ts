import { CreateBook } from '@modules/books/application';
import { SqliteBookRepository } from '@modules/books/infrastructure';
import {
	SharedExpenseBookArchivedError,
	SharedExpenseBookNotFoundError,
	SharedExpenseParticipantBookArchivedError,
	SharedExpenseParticipantBookNotFoundError,
	SharedExpenseParticipantInactiveError,
	SharedExpenseParticipantNotFoundError,
	SharedExpenseParticipantsDuplicateError,
} from '@modules/shared-expenses/domain';
import { initializeSharedExpenseSchema, SqliteSharedExpenseRepository } from '@modules/shared-expenses/infrastructure';
import { migrateDatabase } from '@modules/storage/infrastructure';
import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';

import {
	CloseSharedExpense,
	CreateSharedExpense,
	CreateSharedExpenseParticipant,
	ListSharedExpenseParticipants,
	ListSharedExpenses,
	RemoveSharedExpenseParticipant,
	ReopenSharedExpense,
	SettleSharedExpense,
} from '.';

function setup() {
	const database = new Database(':memory:');
	migrateDatabase(database);
	initializeSharedExpenseSchema(database);
	initializeSharedExpenseSchema(database);
	const books = new SqliteBookRepository(database);
	const book = new CreateBook(books).execute({ currencyCode: 'EUR', name: 'Home' });
	const expenses = new SqliteSharedExpenseRepository(database);

	return {
		book,
		books,
		close: new CloseSharedExpense(expenses),
		create: new CreateSharedExpense(expenses, books),
		createParticipant: new CreateSharedExpenseParticipant(expenses, books),
		database,
		expenses,
		list: new ListSharedExpenses(expenses),
		listParticipants: new ListSharedExpenseParticipants(expenses),
		removeParticipant: new RemoveSharedExpenseParticipant(expenses),
		reopen: new ReopenSharedExpense(expenses),
		settle: new SettleSharedExpense(expenses),
	};
}

describe('shared expense use cases', () => {
	it('throws semantic errors when creating an expense in a missing or archived book', () => {
		const context = setup();
		const input = {
			actor: { kind: 'unknown' as const },
			amountMinor: 100,
			bookId: 'missing',
			description: 'Lunch',
			participantIds: ['person'],
		};

		expect(() => context.create.execute(input)).toThrow(SharedExpenseBookNotFoundError);
		context.books.save(context.book.archive('2026-01-01T00:00:00.000Z'));
		expect(() => context.create.execute({ ...input, bookId: context.book.id })).toThrow(
			SharedExpenseBookArchivedError
		);
		context.database.close();
	});

	it('throws a semantic error when creating a participant for a missing book', () => {
		const context = setup();
		expect(() => context.createParticipant.execute({ bookId: 'missing', id: 'person', name: 'Person' })).toThrow(
			SharedExpenseParticipantBookNotFoundError
		);
		context.database.close();
	});

	it('throws a semantic error when creating a participant for an archived book', () => {
		const context = setup();
		context.books.save(context.book.archive('2026-01-01T00:00:00.000Z'));
		expect(() =>
			context.createParticipant.execute({ bookId: context.book.id, id: 'person', name: 'Person' })
		).toThrow(SharedExpenseParticipantBookArchivedError);
		context.database.close();
	});

	it('records an unknown actor independently of participants and accepts a participant who is not the actor', () => {
		const context = setup();
		context.createParticipant.execute({ bookId: context.book.id, id: 'a', name: 'Alex' });
		context.createParticipant.execute({ bookId: context.book.id, id: 'b', name: 'Blair' });

		const expense = context.create.execute({
			actor: { kind: 'unknown' },
			amountMinor: 101,
			bookId: context.book.id,
			description: 'Groceries',
			participantIds: ['b', 'a'],
		});

		expect(expense.actor).toEqual({ kind: 'unknown' });
		expect(expense.allocations.map(item => [item.participantId, item.amountMinor])).toEqual([
			['a', 51],
			['b', 50],
		]);
		expect(expense.allocations.reduce((sum, item) => sum + item.amountMinor, 0)).toBe(expense.amountMinor);
		expect(context.list.execute({ bookId: context.book.id })).toEqual([expense]);
		context.database.close();
	});

	it('rejects duplicate, missing, and removed participants in an expense', () => {
		const context = setup();
		context.createParticipant.execute({ bookId: context.book.id, id: 'person', name: 'Person' });

		const input = {
			actor: { id: 'actor', kind: 'home_assistant_user' as const },
			amountMinor: 100,
			bookId: context.book.id,
			description: 'Lunch',
			participantIds: ['person'],
		};
		expect(() => context.create.execute({ ...input, participantIds: ['person', 'person'] })).toThrow(
			SharedExpenseParticipantsDuplicateError
		);
		expect(() => context.create.execute({ ...input, participantIds: ['missing'] })).toThrow(
			SharedExpenseParticipantNotFoundError
		);
		context.removeParticipant.execute(context.book.id, 'person', '2026-02-03T00:00:00.000Z');
		expect(() => context.create.execute(input)).toThrow(SharedExpenseParticipantInactiveError);
		context.database.close();
	});

	it('retains participant allocation history after removal', () => {
		const context = setup();
		context.createParticipant.execute({ bookId: context.book.id, id: 'a', name: 'Alex' });
		context.createParticipant.execute({ bookId: context.book.id, id: 'b', name: 'Blair' });
		const expense = context.create.execute({
			actor: { id: 'actor', kind: 'home_assistant_user' },
			amountMinor: 3,
			bookId: context.book.id,
			description: 'Shared item',
			participantIds: ['a', 'b'],
		});

		expect(context.removeParticipant.execute(context.book.id, 'b', '2026-03-01T00:00:00.000Z')).toBe(true);
		expect(context.removeParticipant.execute(context.book.id, 'b', '2026-03-02T00:00:00.000Z')).toBe(false);
		expect(context.listParticipants.execute({ bookId: context.book.id }).map(item => item.id)).toEqual(['a']);
		expect(context.listParticipants.execute({ bookId: context.book.id, includeRemoved: true })).toHaveLength(2);
		expect(context.expenses.find(context.book.id, expense.id)?.allocations).toEqual(expense.allocations);
		expect(
			context.settle.execute({
				actor: { id: 'settler', kind: 'home_assistant_user' },
				bookId: context.book.id,
				expenseId: expense.id,
				participantId: 'b',
				settledAt: '2026-03-03T00:00:00.000Z',
			})
		).toBe(true);
		context.database.close();
	});

	it('records settlements explicitly, idempotently, and separately from ledger transfers', () => {
		const context = setup();
		context.createParticipant.execute({ bookId: context.book.id, id: 'p', name: 'Participant' });
		const expense = context.create.execute({
			actor: { id: 'buyer', kind: 'home_assistant_user' },
			amountMinor: 125,
			bookId: context.book.id,
			description: 'Dinner',
			participantIds: ['p'],
		});
		expect(expense.settlements[0]).toMatchObject({ amountMinor: 125, status: 'pending' });

		expect(
			context.settle.execute({
				actor: { id: 'different-actor', kind: 'home_assistant_user' },
				bookId: context.book.id,
				expenseId: expense.id,
				participantId: 'p',
				settledAt: '2026-03-05T10:00:00.000Z',
			})
		).toBe(true);
		expect(
			context.settle.execute({
				actor: { kind: 'unknown' },
				bookId: context.book.id,
				expenseId: expense.id,
				participantId: 'p',
			})
		).toBe(false);
		expect(context.expenses.find(context.book.id, expense.id)?.settlements[0]).toMatchObject({
			amountMinor: 125,
			settledAt: '2026-03-05T10:00:00.000Z',
			settledByActor: { id: 'different-actor', kind: 'home_assistant_user' },
			status: 'settled',
		});
		expect(context.database.query('SELECT COUNT(*) AS count FROM transfers').get()).toEqual({ count: 0 });
		expect(context.database.query('SELECT COUNT(*) AS count FROM transactions').get()).toEqual({ count: 0 });
		context.database.close();
	});

	it('closes and reopens expenses and disallows settlement while closed', () => {
		const context = setup();
		context.createParticipant.execute({ bookId: context.book.id, id: 'p', name: 'Participant' });
		const expense = context.create.execute({
			actor: { id: 'buyer', kind: 'home_assistant_user' },
			amountMinor: 10,
			bookId: context.book.id,
			description: 'Coffee',
			participantIds: ['p'],
		});

		expect(context.close.execute(context.book.id, expense.id, '2026-03-06T00:00:00.000Z')).toBe(true);
		expect(context.close.execute(context.book.id, expense.id)).toBe(false);
		expect(context.list.execute({ bookId: context.book.id })).toEqual([]);
		expect(context.list.execute({ bookId: context.book.id, includeClosed: true })[0]?.closedAt).toBe(
			'2026-03-06T00:00:00.000Z'
		);
		expect(
			context.settle.execute({
				actor: { kind: 'unknown' },
				bookId: context.book.id,
				expenseId: expense.id,
				participantId: 'p',
			})
		).toBe(false);
		expect(context.reopen.execute(context.book.id, expense.id)).toBe(true);
		expect(context.reopen.execute(context.book.id, expense.id)).toBe(false);
		expect(
			context.settle.execute({
				actor: { kind: 'unknown' },
				bookId: context.book.id,
				expenseId: expense.id,
				participantId: 'p',
			})
		).toBe(true);
		context.database.close();
	});

	it('keeps expenses and participants strictly book-scoped, including adapter operations', () => {
		const context = setup();
		const otherBook = new CreateBook(context.books).execute({ currencyCode: 'USD', name: 'Other' });
		context.createParticipant.execute({ bookId: context.book.id, id: 'shared-id', name: 'Home participant' });
		context.createParticipant.execute({ bookId: otherBook.id, id: 'shared-id', name: 'Other participant' });
		context.createParticipant.execute({ bookId: otherBook.id, id: 'other-only', name: 'Other only' });
		const expense = context.create.execute({
			actor: { id: 'actor-a', kind: 'home_assistant_user' },
			amountMinor: 300,
			bookId: context.book.id,
			description: 'Book A',
			participantIds: ['shared-id'],
		});
		const otherExpense = context.create.execute({
			actor: { id: 'actor-b', kind: 'home_assistant_user' },
			amountMinor: 500,
			bookId: otherBook.id,
			description: 'Book B',
			participantIds: ['shared-id'],
		});

		expect(context.list.execute({ bookId: context.book.id })).toEqual([expense]);
		expect(context.list.execute({ bookId: otherBook.id })).toEqual([otherExpense]);
		expect(context.expenses.find(otherBook.id, expense.id)).toBeUndefined();
		expect(context.close.execute(otherBook.id, expense.id)).toBe(false);
		expect(
			context.settle.execute({
				actor: { kind: 'unknown' },
				bookId: otherBook.id,
				expenseId: expense.id,
				participantId: 'shared-id',
			})
		).toBe(false);
		expect(() =>
			context.database
				.query(
					'INSERT INTO shared_expense_allocations (book_id, expense_id, participant_id, participant_name, amount_minor, position) VALUES (?, ?, ?, ?, ?, ?)'
				)
				.run(context.book.id, expense.id, 'other-only', 'Other only', 1, 1)
		).toThrow();
		context.database.close();
	});
});
