import type {
	ListSharedExpenseParticipantsOptions,
	SharedExpenseParticipant,
	SharedExpenseRepository,
} from '@modules/shared-expenses/domain';

interface ListSharedExpenseParticipantsInput extends ListSharedExpenseParticipantsOptions {
	bookId: string;
}

class ListSharedExpenseParticipants {
	constructor(private readonly expenses: SharedExpenseRepository) {}

	execute(input: ListSharedExpenseParticipantsInput): SharedExpenseParticipant[] {
		return this.expenses.listParticipants(input.bookId, input);
	}
}

export { ListSharedExpenseParticipants, type ListSharedExpenseParticipantsInput };
