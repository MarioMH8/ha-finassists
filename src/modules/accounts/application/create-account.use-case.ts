import { randomUUID } from 'node:crypto';

import type { BookRepository } from '@modules/books/domain';

import type { AccountRepository } from '../domain';
import { Account, AccountBookArchivedError, AccountBookNotFoundError } from '../domain';

interface CreateAccountInput {
	bookId: string;
	kind: string;
	name: string;
	openingBalanceMinor: number;
}

class CreateAccount {
	constructor(
		private readonly accounts: AccountRepository,
		private readonly books: BookRepository
	) {}

	execute(input: CreateAccountInput): Account {
		const book = this.books.find({ id: input.bookId });
		if (!book) {
			throw new AccountBookNotFoundError();
		}

		if (book.archivedAt !== null) {
			throw new AccountBookArchivedError();
		}

		const account = Account.create({
			...input,
			id: randomUUID(),
		});
		this.accounts.create(account);

		return account;
	}
}

export { CreateAccount, type CreateAccountInput };
