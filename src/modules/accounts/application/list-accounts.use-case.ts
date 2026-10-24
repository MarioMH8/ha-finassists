import type { AccountRepository } from '@modules/accounts/domain';

interface ListAccountsInput {
	bookId: string;
	includeClosed?: boolean;
}

class ListAccounts {
	constructor(private readonly repository: AccountRepository) {}

	execute({ bookId, includeClosed }: ListAccountsInput): ReturnType<AccountRepository['search']> {
		return this.repository.search({ bookId, ...(!includeClosed && { closed: false }) });
	}
}

export { ListAccounts, type ListAccountsInput };
