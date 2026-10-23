import type { AccountRepository } from '../domain';

class ReopenAccount {
	constructor(private readonly repository: AccountRepository) {}

	/**
	 *Returns false when the account is missing in the book or not closed.
	 */
	execute(bookId: string, id: string): boolean {
		return this.repository.reopen(bookId, id);
	}
}

export { ReopenAccount };
