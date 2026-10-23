import { describe, expect, it } from 'bun:test';

import { createSharedExpense, SHARED_EXPENSE_SETTLEMENT_STATUS, SharedExpenseParticipant } from '.';

function participant(id: string, bookId = 'book-a') {
	return SharedExpenseParticipant.create({ bookId, id, name: `Person ${id}` });
}

function create(
	amountMinor: number,
	participantIds: string[],
	actor?: { id: string; kind: 'home_assistant_user' } | { kind: 'unknown' }
) {
	return createSharedExpense({
		actor: actor ?? { id: 'actor-not-in-list', kind: 'home_assistant_user' },
		amountMinor,
		bookId: 'book-a',
		description: ' Dinner ',
		id: 'expense-1',
		participants: participantIds.map(id => participant(id)),
	});
}

describe('shared expense domain', () => {
	it('allocates the whole amount in minor units with a stable tie-break independent of participant input order', () => {
		const expense = create(11, ['c', 'a', 'b']);

		expect(expense.allocations).toEqual([
			{ amountMinor: 4, participantId: 'a', participantName: 'Person a' },
			{ amountMinor: 4, participantId: 'b', participantName: 'Person b' },
			{ amountMinor: 3, participantId: 'c', participantName: 'Person c' },
		]);
		expect(expense.allocations.reduce((sum, allocation) => sum + allocation.amountMinor, 0)).toBe(11);
		expect(expense.actor).toEqual({ id: 'actor-not-in-list', kind: 'home_assistant_user' });
		expect(
			expense.allocations.some(
				allocation => allocation.participantId === ('id' in expense.actor ? expense.actor.id : undefined)
			)
		).toBe(false);
		expect(expense.description).toBe('Dinner');
	});

	it('accepts an unknown actor without changing participant or allocation rules', () => {
		const expense = create(5, ['p1', 'p2'], { kind: 'unknown' });

		expect(expense.actor).toEqual({ kind: 'unknown' });
		expect(expense.allocations.map(allocation => allocation.amountMinor)).toEqual([3, 2]);
		expect(
			expense.settlements.every(settlement => settlement.status === SHARED_EXPENSE_SETTLEMENT_STATUS.PENDING)
		).toBe(true);
	});

	it('rejects unsafe or non-positive amounts, duplicates, and participants from another book', () => {
		expect(() => create(Number.MAX_SAFE_INTEGER + 1, ['a'])).toThrow('safe integer');
		expect(() => create(1.5, ['a'])).toThrow('safe integer');
		expect(() => create(0, ['a'])).toThrow('greater than zero');
		expect(() => create(5, [])).toThrow('at least one participant');
		expect(() => create(5, ['a', 'a'])).toThrow('unique');
		expect(() =>
			createSharedExpense({
				actor: { kind: 'unknown' },
				amountMinor: 1,
				bookId: 'book-a',
				description: 'Test',
				id: 'expense-2',
				participants: [participant('a', 'book-b')],
			})
		).toThrow('same book');
	});
});
