import { AccountMother } from '@modules/accounts/domain/account.mother';
import { MockAccountRepository } from '@modules/accounts/infrastructure/repositories/mock-account.repository';
import { BookMother } from '@modules/books/domain/book.mother';
import { MockBookRepository } from '@modules/books/infrastructure/repositories/mock-book.repository';
import {
	BudgetAccountNotFoundError,
	BudgetBookArchivedError,
	BudgetBookNotFoundError,
	BudgetCategoryArchivedError,
	BudgetCategoryNotFoundError,
	BudgetClassArchivedError,
	BudgetClassNotFoundError,
} from '@modules/budgets/domain';
import { MockBudgetRepository } from '@modules/budgets/infrastructure/repositories/mock-budget.repository';
import { ClassificationMother } from '@modules/classifications/domain/classification.mother';
import { MockClassificationRepository } from '@modules/classifications/infrastructure/repositories/mock-classification.repository';
import { describe, expect, it } from 'bun:test';

import { CreateBudget } from './create-budget.use-case';

const NO_SCOPE = JSON.parse('null') as null;
const ARCHIVED_AT = '2026-01-01T00:00:00.000Z';
const input = {
	accountId: 'account-1',
	bookId: 'book-1',
	name: 'March',
	periodEnd: '2026-03-31',
	periodStart: '2026-03-01',
	plannedMinor: 1000,
};

function createUseCase() {
	const budgets = new MockBudgetRepository();
	const books = new MockBookRepository();
	const accounts = new MockAccountRepository();
	const categories = new MockClassificationRepository('category');
	const classes = new MockClassificationRepository('class');
	books.shouldFind(BookMother.create({ currencyCode: 'USD', id: 'book-1' }));
	accounts.shouldFind(AccountMother.create());

	return {
		accounts,
		books,
		budgets,
		categories,
		classes,
		useCase: new CreateBudget(budgets, books, accounts, categories, classes),
	};
}

describe('CreateBudget', () => {
	describe('execute', () => {
		it('should create and persist an unscoped budget in the book currency', () => {
			const { accounts, books, budgets, categories, classes, useCase } = createUseCase();

			const budget = useCase.execute(input);

			expect(budget).toMatchObject({ ...input, currencyCode: 'USD' });
			expect(budget.categoryId).toBeNull();
			expect(budget.classId).toBeNull();
			books.assertFindHasBeenCalledWith({ id: 'book-1' });
			accounts.assertFindHasBeenCalledWith({ bookId: 'book-1', id: 'account-1' });
			budgets.assertSaveHasBeenCalledWith(budget);
			categories.assertFindHasNotBeenCalled();
			classes.assertFindHasNotBeenCalled();
		});

		it('should skip category and class lookups when their ids are null', () => {
			const { categories, classes, useCase } = createUseCase();
			categories.shouldFind(ClassificationMother.create({ id: 'unused' }));
			classes.shouldFind(ClassificationMother.create({ id: 'unused' }, 'class'));

			const budget = useCase.execute({ ...input, categoryId: NO_SCOPE, classId: NO_SCOPE });

			expect(budget.categoryId).toBeNull();
			expect(budget.classId).toBeNull();
			categories.assertFindHasNotBeenCalled();
			classes.assertFindHasNotBeenCalled();
		});

		it('should scope the budget to an active category and class', () => {
			const { budgets, categories, classes, useCase } = createUseCase();
			categories.shouldFind(ClassificationMother.create({ id: 'category-1' }));
			classes.shouldFind(ClassificationMother.create({ id: 'class-1' }, 'class'));

			const budget = useCase.execute({ ...input, categoryId: 'category-1', classId: 'class-1' });

			expect(budget).toMatchObject({ categoryId: 'category-1', classId: 'class-1' });
			categories.assertFindHasBeenCalledWith('book-1', 'category-1');
			classes.assertFindHasBeenCalledWith('book-1', 'class-1');
			budgets.assertSaveHasBeenCalledWith(budget);
		});

		it('should fail without saving when the book does not exist', () => {
			const { books, budgets, useCase } = createUseCase();
			books.shouldFind(undefined);

			expect(() => useCase.execute(input)).toThrow(BudgetBookNotFoundError);
			budgets.assertSaveHasNotBeenCalled();
		});

		it('should fail without saving when the book is archived', () => {
			const { books, budgets, useCase } = createUseCase();
			books.shouldFind(BookMother.create({ archivedAt: ARCHIVED_AT }));

			expect(() => useCase.execute(input)).toThrow(BudgetBookArchivedError);
			budgets.assertSaveHasNotBeenCalled();
		});

		it('should fail without saving when the account does not exist in the book', () => {
			const { accounts, budgets, useCase } = createUseCase();
			accounts.shouldFind(undefined);

			expect(() => useCase.execute(input)).toThrow(BudgetAccountNotFoundError);
			budgets.assertSaveHasNotBeenCalled();
		});

		it('should fail without saving when the category does not exist', () => {
			const { budgets, useCase } = createUseCase();

			expect(() => useCase.execute({ ...input, categoryId: 'missing' })).toThrow(BudgetCategoryNotFoundError);
			budgets.assertSaveHasNotBeenCalled();
		});

		it('should fail without saving when the category is archived', () => {
			const { budgets, categories, useCase } = createUseCase();
			categories.shouldFind(ClassificationMother.create({ archivedAt: ARCHIVED_AT, id: 'category-1' }));

			expect(() => useCase.execute({ ...input, categoryId: 'category-1' })).toThrow(BudgetCategoryArchivedError);
			budgets.assertSaveHasNotBeenCalled();
		});

		it('should fail without saving when the class does not exist', () => {
			const { budgets, useCase } = createUseCase();

			expect(() => useCase.execute({ ...input, classId: 'missing' })).toThrow(BudgetClassNotFoundError);
			budgets.assertSaveHasNotBeenCalled();
		});

		it('should fail without saving when the class is archived', () => {
			const { budgets, classes, useCase } = createUseCase();
			classes.shouldFind(ClassificationMother.create({ archivedAt: ARCHIVED_AT, id: 'class-1' }, 'class'));

			expect(() => useCase.execute({ ...input, classId: 'class-1' })).toThrow(BudgetClassArchivedError);
			budgets.assertSaveHasNotBeenCalled();
		});
	});
});
