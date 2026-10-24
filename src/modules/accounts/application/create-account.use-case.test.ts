import { AccountBookArchivedError, AccountBookNotFoundError } from '@modules/accounts/domain';
import { MockAccountRepository } from '@modules/accounts/infrastructure/repositories/mock-account.repository';
import { BookMother } from '@modules/books/domain/book.mother';
import { MockBookRepository } from '@modules/books/infrastructure/repositories/mock-book.repository';
import { describe, expect, it } from 'bun:test';

import { CreateAccount } from './create-account.use-case';

const input = { bookId: 'book-1', kind: 'savings', name: 'Rainy day', openingBalanceMinor: 2500 };

describe('CreateAccount', () => {
	describe('execute', () => {
		it('should create, persist and return an open account in an active book', () => {
			const accounts = new MockAccountRepository();
			const books = new MockBookRepository();
			books.shouldFind(BookMother.create({ id: 'book-1' }));
			const useCase = new CreateAccount(accounts, books);

			const account = useCase.execute(input);

			expect(account).toMatchObject(input);
			expect(account.closedAt).toBeNull();
			expect(account.id).not.toBe('');
			books.assertFindHasBeenCalledWith({ id: 'book-1' });
			accounts.assertSaveHasBeenCalledWith(account);
		});

		it('should fail without saving when the book does not exist', () => {
			const accounts = new MockAccountRepository();
			const books = new MockBookRepository();
			const useCase = new CreateAccount(accounts, books);

			expect(() => useCase.execute(input)).toThrow(AccountBookNotFoundError);
			accounts.assertSaveHasNotBeenCalled();
		});

		it('should fail without saving when the book is archived', () => {
			const accounts = new MockAccountRepository();
			const books = new MockBookRepository();
			books.shouldFind(BookMother.create({ archivedAt: '2026-01-01T00:00:00.000Z' }));
			const useCase = new CreateAccount(accounts, books);

			expect(() => useCase.execute(input)).toThrow(AccountBookArchivedError);
			accounts.assertSaveHasNotBeenCalled();
		});
	});
});
