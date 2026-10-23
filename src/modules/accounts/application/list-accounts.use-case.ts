import type { AccountRepository } from '../domain';

interface ListAccountsInput {
	bookId: string;
	includeClosed?: boolean;
}

class ListAccounts {
	constructor(private readonly repository: AccountRepository) {}

	execute({ bookId, includeClosed }: ListAccountsInput): ReturnType<AccountRepository['list']> {
		return this.repository.list(bookId, { includeClosed });
	}
}

export { ListAccounts, type ListAccountsInput };
