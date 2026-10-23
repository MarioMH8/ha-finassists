/* eslint-disable unicorn/no-null -- SQLite uses NULL for unscoped transaction classifications. */
import { CreateAccount } from '@modules/accounts/application';
import { SqliteAccountRepository } from '@modules/accounts/infrastructure';
import { CreateBook } from '@modules/books/application';
import { SqliteBookRepository } from '@modules/books/infrastructure';
import { CreateClassification, SqliteCategoryRepository, SqliteClassRepository } from '@modules/classifications';
import { migrateDatabase } from '@modules/storage/infrastructure';
import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';

import { CreateBudget, GetBudgetReport, ListBudgets } from '../../application';
import { Budget, BudgetIdentityConflictError, BudgetPeriodOverlapError } from '../../domain';
import { initializeBudgetSchema } from '../initialize-budget-schema';
import { SqliteBudgetActualsQuery } from '../queries';
import { SqliteBudgetRepository } from './sqlite-budget.repository';

function setup() {
	const database = new Database(':memory:');
	migrateDatabase(database);
	initializeBudgetSchema(database);
	initializeBudgetSchema(database);

	const books = new SqliteBookRepository(database);
	const accounts = new SqliteAccountRepository(database);
	const categories = new SqliteCategoryRepository(database);
	const classes = new SqliteClassRepository(database);
	const budgetRepository = new SqliteBudgetRepository(database);
	const budgetActuals = new SqliteBudgetActualsQuery(database);
	const book = new CreateBook(books).execute({ currencyCode: 'USD', name: 'Household' });
	const account = new CreateAccount(accounts, books).execute({
		bookId: book.id,
		kind: 'checking',
		name: 'Main',
		openingBalanceMinor: 0,
	});
	const categoryCreator = new CreateClassification(categories);
	const classCreator = new CreateClassification(classes);
	const food = categoryCreator.execute({ bookId: book.id, name: 'Food' });
	const groceries = categoryCreator.execute({ bookId: book.id, name: 'Groceries', parentId: food.id });
	const travel = categoryCreator.execute({ bookId: book.id, name: 'Travel' });
	const householdClass = classCreator.execute({ bookId: book.id, name: 'Household' });
	const familyClass = classCreator.execute({ bookId: book.id, name: 'Family', parentId: householdClass.id });
	const create = new CreateBudget(budgetRepository, books, accounts, categories, classes);
	const report = new GetBudgetReport(budgetRepository, budgetActuals);
	const list = new ListBudgets(budgetRepository);
	let sequence = 0;

	function addTransaction(options: {
		accountId?: string;
		amountMinor: number;
		bookId?: string;
		categoryId?: null | string;
		classId?: null | string;
		date: string;
		status?: 'cleared' | 'reconciled' | 'uncleared';
	}) {
		sequence += 1;
		const transactionId = `transaction-${sequence.toString()}`;
		const bookId = options.bookId ?? book.id;
		database
			.query(
				'INSERT INTO transactions (id, book_id, account_id, transaction_date, amount_minor, status) VALUES (?, ?, ?, ?, ?, ?)'
			)
			.run(
				transactionId,
				bookId,
				options.accountId ?? account.id,
				options.date,
				options.amountMinor,
				options.status ?? 'cleared'
			);
		if (options.categoryId !== undefined || options.classId !== undefined) {
			database
				.query(
					'INSERT INTO transaction_parts (id, book_id, transaction_id, category_id, class_id, amount_minor) VALUES (?, ?, ?, ?, ?, ?)'
				)
				.run(
					`part-${sequence.toString()}`,
					bookId,
					transactionId,
					options.categoryId ?? null,
					options.classId ?? null,
					options.amountMinor
				);
		}

		return transactionId;
	}

	return {
		account,
		accounts,
		addTransaction,
		book,
		books,
		budgetRepository,
		categories,
		categoryCreator,
		classCreator,
		classes,
		create,
		database,
		familyClass,
		food,
		groceries,
		householdClass,
		list,
		report,
		travel,
	};
}

const dates = { periodEnd: '2026-03-31', periodStart: '2026-03-01' };

describe('budget module', () => {
	it('finds, searches, saves and deletes budgets with generic repository criteria', () => {
		const context = setup();
		const created = context.create.execute({
			accountId: context.account.id,
			bookId: context.book.id,
			name: 'March',
			...dates,
			plannedMinor: 1000,
		});
		const criteria = { bookId: context.book.id, id: created.id };

		expect(context.budgetRepository.find(criteria)).toEqual(created);
		expect(context.budgetRepository.search({ accountId: context.account.id, bookId: context.book.id })).toEqual([
			created,
		]);
		expect(context.budgetRepository.search({ bookId: context.book.id, categoryId: null })).toEqual([created]);
		expect(context.list.execute({ accountId: '', bookId: context.book.id })).toEqual([]);

		const updated = Budget.create({
			accountId: created.accountId,
			bookId: created.bookId,
			categoryId: created.categoryId,
			classId: created.classId,
			currencyCode: created.currencyCode,
			id: created.id,
			name: 'March adjusted',
			periodEnd: created.periodEnd,
			periodStart: created.periodStart,
			plannedMinor: 1500,
		});
		context.budgetRepository.save(updated);

		expect(context.budgetRepository.find(criteria)).toEqual(updated);
		const conflictingIdentity = Budget.create({
			accountId: 'another-account',
			bookId: 'another-book',
			categoryId: updated.categoryId,
			classId: updated.classId,
			currencyCode: updated.currencyCode,
			id: updated.id,
			name: updated.name,
			periodEnd: updated.periodEnd,
			periodStart: updated.periodStart,
			plannedMinor: updated.plannedMinor,
		});
		expect(() => context.budgetRepository.save(conflictingIdentity)).toThrow(BudgetIdentityConflictError);
		expect(context.budgetRepository.delete(criteria)).toBe(true);
		expect(context.budgetRepository.find(criteria)).toBeUndefined();
		context.database.close();
	});

	it('creates, lists and reports budgets within strict book/account/category/class boundaries', () => {
		const context = setup();
		const budget = context.create.execute({
			accountId: context.account.id,
			bookId: context.book.id,
			categoryId: context.food.id,
			classId: context.householdClass.id,
			name: 'Food',
			...dates,
			plannedMinor: 10_000,
		});
		const otherBook = new CreateBook(context.books).execute({ currencyCode: 'EUR', name: 'Other' });
		const otherAccount = new CreateAccount(context.accounts, context.books).execute({
			bookId: otherBook.id,
			kind: 'checking',
			name: 'Other account',
			openingBalanceMinor: 0,
		});
		const otherCategory = context.categoryCreator.execute({ bookId: otherBook.id, name: 'Other category' });
		const otherClass = context.classCreator.execute({ bookId: otherBook.id, name: 'Other class' });

		expect(context.list.execute({ bookId: context.book.id })).toEqual([budget]);
		expect(context.list.execute({ bookId: otherBook.id })).toEqual([]);
		expect(() =>
			context.create.execute({
				accountId: otherAccount.id,
				bookId: context.book.id,
				name: 'Wrong account book',
				...dates,
				plannedMinor: 1,
			})
		).toThrow('Account not found in this book');
		expect(() =>
			context.create.execute({
				accountId: context.account.id,
				bookId: context.book.id,
				categoryId: otherCategory.id,
				name: 'Wrong category book',
				...dates,
				plannedMinor: 1,
			})
		).toThrow('Category not found in this book');
		expect(() =>
			context.create.execute({
				accountId: context.account.id,
				bookId: context.book.id,
				classId: otherClass.id,
				name: 'Wrong class book',
				...dates,
				plannedMinor: 1,
			})
		).toThrow('Class not found in this book');
		context.database.close();
	});

	it('treats dates inclusively, rolls no amounts forward, and calculates deterministic positive spending', () => {
		const context = setup();
		const budget = context.create.execute({
			accountId: context.account.id,
			bookId: context.book.id,
			categoryId: context.food.id,
			classId: context.householdClass.id,
			name: 'March food',
			periodEnd: '2026-03-31',
			periodStart: '2026-03-01',
			plannedMinor: 1000,
		});
		context.addTransaction({
			amountMinor: -100,
			categoryId: context.groceries.id,
			classId: context.familyClass.id,
			date: '2026-03-01',
			status: 'cleared',
		});
		context.addTransaction({
			amountMinor: -50,
			categoryId: context.groceries.id,
			classId: context.familyClass.id,
			date: '2026-03-31',
			status: 'reconciled',
		});
		context.addTransaction({
			amountMinor: -500,
			categoryId: context.groceries.id,
			classId: context.familyClass.id,
			date: '2026-03-15',
			status: 'uncleared',
		});
		context.addTransaction({
			amountMinor: -900,
			categoryId: context.groceries.id,
			classId: context.familyClass.id,
			date: '2026-02-28',
		});
		context.addTransaction({
			amountMinor: -800,
			categoryId: context.travel.id,
			classId: context.familyClass.id,
			date: '2026-03-15',
		});
		context.addTransaction({
			amountMinor: -700,
			categoryId: context.groceries.id,
			classId: null,
			date: '2026-03-15',
		});
		context.addTransaction({
			amountMinor: 60,
			categoryId: context.groceries.id,
			classId: context.familyClass.id,
			date: '2026-03-15',
		});

		expect(context.report.execute({ bookId: context.book.id, id: budget.id })).toEqual({
			actualMinor: 150,
			budget,
			remainingMinor: 850,
		});
		context.database.close();
	});

	it('includes archived descendants in existing budget reports but rejects new archived scopes', () => {
		const context = setup();
		const budget = context.create.execute({
			accountId: context.account.id,
			bookId: context.book.id,
			categoryId: context.food.id,
			name: 'Food',
			...dates,
			plannedMinor: 1000,
		});
		context.addTransaction({
			amountMinor: -125,
			categoryId: context.groceries.id,
			date: '2026-03-15',
		});
		context.categories.archiveSubtree(context.book.id, context.food.id, '2026-04-01T00:00:00.000Z');

		expect(context.report.execute({ bookId: context.book.id, id: budget.id }).actualMinor).toBe(125);
		expect(() =>
			context.create.execute({
				accountId: context.account.id,
				bookId: context.book.id,
				categoryId: context.food.id,
				name: 'New archived scope',
				periodEnd: '2026-04-30',
				periodStart: '2026-04-01',
				plannedMinor: 1,
			})
		).toThrow('archived category');
		context.database.close();
	});

	it('prevents inclusive overlaps for the same account and exact scope, but permits adjacent periods and other scopes', () => {
		const context = setup();
		const budgetInput = {
			accountId: context.account.id,
			bookId: context.book.id,
			categoryId: context.food.id,
			name: 'March',
			periodEnd: '2026-03-31',
			periodStart: '2026-03-01',
			plannedMinor: 100,
		};
		context.create.execute(budgetInput);

		expect(() =>
			context.create.execute({
				...budgetInput,
				name: 'Touching',
				periodEnd: '2026-04-30',
				periodStart: '2026-03-31',
			})
		).toThrow(BudgetPeriodOverlapError);
		expect(() =>
			context.create.execute({ ...budgetInput, categoryId: context.groceries.id, name: 'Nested scope' })
		).not.toThrow();
		expect(() =>
			context.create.execute({
				...budgetInput,
				name: 'Next period',
				periodEnd: '2026-04-30',
				periodStart: '2026-04-01',
			})
		).not.toThrow();
		context.database.close();
	});

	it('uses exact integer accumulation and refuses reports outside the safe integer range', () => {
		const context = setup();
		const budget = context.create.execute({
			accountId: context.account.id,
			bookId: context.book.id,
			name: 'Large',
			...dates,
			plannedMinor: Number.MAX_SAFE_INTEGER,
		});
		context.addTransaction({ amountMinor: -Number.MAX_SAFE_INTEGER, date: '2026-03-01' });
		context.addTransaction({ amountMinor: -Number.MAX_SAFE_INTEGER, date: '2026-03-02' });

		expect(() => context.report.execute({ bookId: context.book.id, id: budget.id })).toThrow(
			'Budget actual amount exceeds the safe integer range'
		);
		context.database.close();
	});

	it('enforces safe integer planned amounts in SQLite', () => {
		const context = setup();

		expect(() =>
			context.database
				.query(
					'INSERT INTO budgets (id, book_id, account_id, name, period_start, period_end, planned_minor, currency_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
				)
				.run(
					'unsafe',
					context.book.id,
					context.account.id,
					'Unsafe',
					'2026-03-01',
					'2026-03-31',
					9_007_199_254_740_992,
					'USD'
				)
		).toThrow();
		expect(() =>
			context.database
				.query(
					'INSERT INTO budgets (id, book_id, account_id, name, period_start, period_end, planned_minor, currency_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
				)
				.run(
					'fraction',
					context.book.id,
					context.account.id,
					'Fraction',
					'2026-03-01',
					'2026-03-31',
					1.5,
					'USD'
				)
		).toThrow();
		context.database.close();
	});

	it('enforces overlap protection in SQLite even for writes outside the repository', () => {
		const context = setup();
		const budget = context.create.execute({
			accountId: context.account.id,
			bookId: context.book.id,
			name: 'First',
			...dates,
			plannedMinor: 100,
		});

		expect(() =>
			context.database
				.query(
					'INSERT INTO budgets (id, book_id, account_id, name, period_start, period_end, planned_minor, currency_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
				)
				.run(
					'overlap',
					budget.bookId,
					budget.accountId,
					'Second',
					'2026-03-31',
					'2026-04-30',
					1,
					budget.currencyCode
				)
		).toThrow('budget_period_overlap');
		context.database.close();
	});
});
