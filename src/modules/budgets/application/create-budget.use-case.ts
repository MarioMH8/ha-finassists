import { randomUUID } from 'node:crypto';

import type { AccountRepository } from '@modules/accounts/domain';
import type { BookRepository } from '@modules/books/domain';
import type { CategoryRepository, ClassRepository } from '@modules/classifications/domain';

import type { Budget, BudgetRepository } from '../domain';
import { createBudget } from '../domain';

interface CreateBudgetInput {
	accountId: string;
	bookId: string;
	categoryId?: null | string;
	classId?: null | string;
	name: string;
	periodEnd: string;
	periodStart: string;
	plannedMinor: number;
}

class CreateBudget {
	constructor(
		private readonly budgets: BudgetRepository,
		private readonly books: BookRepository,
		private readonly accounts: AccountRepository,
		private readonly categories: CategoryRepository,
		private readonly classes: ClassRepository
	) {}

	execute(input: CreateBudgetInput): Budget {
		const book = this.books.find(input.bookId);
		if (!book) {
			throw new Error('Book not found');
		}
		if (book.archivedAt !== null) {
			throw new Error('Cannot create budgets in an archived book');
		}

		const account = this.accounts.find(input.bookId, input.accountId);
		if (!account) {
			throw new Error('Account not found in this book');
		}

		if (input.categoryId) {
			const category = this.categories.find(input.bookId, input.categoryId);
			if (!category) {
				throw new Error('Category not found in this book');
			}
			if (category.archivedAt !== null) {
				throw new Error('Cannot create a budget for an archived category');
			}
		}
		if (input.classId) {
			const classification = this.classes.find(input.bookId, input.classId);
			if (!classification) {
				throw new Error('Class not found in this book');
			}
			if (classification.archivedAt !== null) {
				throw new Error('Cannot create a budget for an archived class');
			}
		}

		return this.budgets.create(
			createBudget({
				...input,
				currencyCode: book.currencyCode,
				id: randomUUID(),
			})
		);
	}
}

export { CreateBudget, type CreateBudgetInput };
