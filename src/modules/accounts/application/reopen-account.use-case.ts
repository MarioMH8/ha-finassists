import type { AccountRepository } from '@modules/accounts/domain';

class ReopenAccount {
	constructor(private readonly repository: AccountRepository) {}

	/**
	 *Returns false when the account is missing in the book or not closed.
	 */
	execute(bookId: string, id: string): boolean {
		const account = this.repository.find({ bookId, id });
		if (!account?.closedAt) {
			return false;
		}

		this.repository.save(account.reopen());

		return true;
	}
}

export { ReopenAccount };
