import type { AccountInput } from './account';
import { Account } from './account';

export class AccountMother {
	static create(overrides?: Partial<AccountInput>): Account {
		return Account.create({
			bookId: 'book-1',
			id: 'account-1',
			kind: 'checking',
			name: 'Main account',
			openingBalanceMinor: 0,
			...overrides,
		});
	}
}
