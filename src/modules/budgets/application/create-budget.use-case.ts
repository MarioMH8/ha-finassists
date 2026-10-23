import { randomUUID } from 'node:crypto';

import type { AccountRepository } from '@modules/accounts/domain';
import type { BookRepository } from '@modules/books/domain';
import type { CategoryRepository, ClassRepository } from '@modules/classifications/domain';

import type { BudgetRepository } from '../domain';
import {
	Budget,
	BudgetAccountNotFoundError,
	BudgetBookArchivedError,
	BudgetBookNotFoundError,
	BudgetCategoryArchivedError,
	BudgetCategoryNotFoundError,
	BudgetClassArchivedError,
	BudgetClassNotFoundError,
} from '../domain';

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
		const book = this.books.find({ id: input.bookId });
		if (!book) {
			throw new BudgetBookNotFoundError();
		}
		if (book.archivedAt !== null) {
			throw new BudgetBookArchivedError();
		}

		const account = this.accounts.find(input.bookId, input.accountId);
		if (!account) {
			throw new BudgetAccountNotFoundError();
		}

		if (input.categoryId) {
			const category = this.categories.find(input.bookId, input.categoryId);
			if (!category) {
				throw new BudgetCategoryNotFoundError();
			}
			if (category.archivedAt !== null) {
				throw new BudgetCategoryArchivedError();
			}
		}
		if (input.classId) {
			const classification = this.classes.find(input.bookId, input.classId);
			if (!classification) {
				throw new BudgetClassNotFoundError();
			}
			if (classification.archivedAt !== null) {
				throw new BudgetClassArchivedError();
			}
		}

		const budget = Budget.create({
			...input,
			currencyCode: book.currencyCode,
			id: randomUUID(),
		});
		this.budgets.save(budget);

		return budget;
	}
}

export { CreateBudget, type CreateBudgetInput };
