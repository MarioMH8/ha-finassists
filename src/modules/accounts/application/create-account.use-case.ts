import { randomUUID } from 'node:crypto';

import type { BookRepository } from '@modules/books/domain';
import { Currency } from '@modules/money/domain';

import type { AccountRepository } from '../domain';
import { createAccount } from '../domain';

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

	execute(input: CreateAccountInput): ReturnType<typeof createAccount> {
		const book = this.books.find(input.bookId);
		if (!book) {
			throw new Error('Book not found');
		}

		if (book.archivedAt !== null) {
			throw new Error('Cannot create accounts in an archived book');
		}

		const account = createAccount({
			...input,
			currency: Currency.create(book.currencyCode),
			id: randomUUID(),
		});
		this.accounts.create(account);

		return account;
	}
}

export { CreateAccount, type CreateAccountInput };
