import type { AccountRepository } from '../domain';

class CloseAccount {
	constructor(private readonly repository: AccountRepository) {}

	/**
	 *Returns false when the account is missing in the book or already closed.
	 */
	execute(bookId: string, id: string): boolean {
		return this.repository.close(bookId, id, new Date().toISOString());
	}
}

export { CloseAccount };
