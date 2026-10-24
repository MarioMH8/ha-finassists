import type { SharedExpenseRepository } from '@modules/shared-expenses/domain';

class RemoveSharedExpenseParticipant {
	constructor(private readonly expenses: SharedExpenseRepository) {}

	execute(bookId: string, participantId: string, removedAt = new Date().toISOString()): boolean {
		return this.expenses.removeParticipant(bookId, participantId, removedAt);
	}
}

export { RemoveSharedExpenseParticipant };
