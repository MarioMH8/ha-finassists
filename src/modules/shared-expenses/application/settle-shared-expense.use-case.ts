import type { IngressActor } from '@modules/home-assistant/domain';
import type { SharedExpenseRepository } from '@modules/shared-expenses/domain';
import { SharedExpense } from '@modules/shared-expenses/domain';

interface SettleSharedExpenseInput {
	actor: IngressActor;
	bookId: string;
	expenseId: string;
	participantId: string;
	settledAt?: string;
}

class SettleSharedExpense {
	constructor(private readonly expenses: SharedExpenseRepository) {}

	execute(input: SettleSharedExpenseInput): boolean {
		return this.expenses.settle(
			input.bookId,
			input.expenseId,
			input.participantId,
			SharedExpense.normalizeActor(input.actor),
			input.settledAt ?? new Date().toISOString()
		);
	}
}

export { SettleSharedExpense, type SettleSharedExpenseInput };
