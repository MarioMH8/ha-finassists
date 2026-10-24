import type { AccountRepository } from '@modules/accounts/domain';

class CloseAccount {
	constructor(private readonly repository: AccountRepository) {}

	/**
	 *Returns false when the account is missing in the book or already closed.
	 */
	execute(bookId: string, id: string): boolean {
		const account = this.repository.find({ bookId, id });
		if (account?.closedAt !== null) {
			return false;
		}

		this.repository.save(account.close(new Date().toISOString()));

		return true;
	}
}

export { CloseAccount };
