import { describe, expect, it } from 'bun:test';

import {
	SHARED_EXPENSE_SETTLEMENT_STATUS,
	SharedExpense,
	SharedExpenseAmountInvalidError,
	SharedExpenseAmountNonPositiveError,
	SharedExpenseParticipant,
	SharedExpenseParticipantBookMismatchError,
	SharedExpenseParticipantInactiveError,
	SharedExpenseParticipantsDuplicateError,
	SharedExpenseParticipantsMissingError,
	SharedExpenseSettlementTransitionInvalidError,
	SharedExpenseTransitionInvalidError,
} from '.';

function participant(id: string, bookId = 'book-a') {
	return SharedExpenseParticipant.create({ bookId, id, name: `Person ${id}` });
}

function create(
	amountMinor: number,
	participantIds: string[],
	actor?: { id: string; kind: 'home_assistant_user' } | { kind: 'unknown' }
) {
	return SharedExpense.create({
		actor: actor ?? { id: 'actor-not-in-list', kind: 'home_assistant_user' },
		amountMinor,
		bookId: 'book-a',
		description: ' Dinner ',
		id: 'expense-1',
		participants: participantIds.map(id => participant(id)),
	});
}

describe('SharedExpense', () => {
	it('allocates minor units with a stable participant tie-break and immutable state', () => {
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
		expect(Object.isFrozen(expense)).toBe(true);
		expect(Object.isFrozen(expense.allocations)).toBe(true);
		expect(Object.isFrozen(expense.allocations[0])).toBe(true);
		expect(Object.isFrozen(expense.settlements)).toBe(true);
	});

	it('accepts an unknown actor without changing participant or allocation rules', () => {
		const expense = create(5, ['p1', 'p2'], { kind: 'unknown' });

		expect(expense.actor).toEqual({ kind: 'unknown' });
		expect(expense.allocations.map(allocation => allocation.amountMinor)).toEqual([3, 2]);
		expect(
			expense.settlements.every(settlement => settlement.status === SHARED_EXPENSE_SETTLEMENT_STATUS.PENDING)
		).toBe(true);
	});

	it('restores persisted state as an entity without changing its serialized shape', () => {
		const original = create(17, ['b', 'a']);
		const restored = SharedExpense.restore(original);

		expect(restored).toBeInstanceOf(SharedExpense);
		expect(restored).toEqual(original);
		expect(JSON.stringify(restored)).toBe(
			JSON.stringify({
				actor: { id: 'actor-not-in-list', kind: 'home_assistant_user' },
				allocations: [
					{ amountMinor: 9, participantId: 'a', participantName: 'Person a' },
					{ amountMinor: 8, participantId: 'b', participantName: 'Person b' },
				],
				amountMinor: 17,
				bookId: 'book-a',
				createdAt: original.createdAt,
				description: 'Dinner',
				id: 'expense-1',
				settlements: [
					{ amountMinor: 9, participantId: 'a', status: 'pending' },
					{ amountMinor: 8, participantId: 'b', status: 'pending' },
				],
			})
		);
	});

	it('applies close, reopen, and settlement transitions immutably', () => {
		const expense = create(20, ['p']);
		const closed = expense.close('2026-03-01T00:00:00.000Z');
		const reopened = closed.reopen();
		const settled = reopened.settle('p', { kind: 'unknown' }, '2026-03-02T00:00:00.000Z');

		expect(expense.closedAt).toBeUndefined();
		expect(closed.closedAt).toBe('2026-03-01T00:00:00.000Z');
		expect(reopened.closedAt).toBeUndefined();
		expect(settled.settlements).toEqual([
			{
				amountMinor: 20,
				participantId: 'p',
				settledAt: '2026-03-02T00:00:00.000Z',
				settledByActor: { kind: 'unknown' },
				status: 'settled',
			},
		]);
		expect(() => closed.settle('p', { kind: 'unknown' }, '2026-03-02T00:00:00.000Z')).toThrow(
			SharedExpenseTransitionInvalidError
		);
		expect(() => settled.settle('p', { kind: 'unknown' }, '2026-03-03T00:00:00.000Z')).toThrow(
			SharedExpenseSettlementTransitionInvalidError
		);
		expect(() => expense.reopen()).toThrow(SharedExpenseTransitionInvalidError);
	});

	it('rejects invalid amounts, participants, and participant book membership', () => {
		expect(() => create(Number.MAX_SAFE_INTEGER + 1, ['a'])).toThrow(SharedExpenseAmountInvalidError);
		expect(() => create(1.5, ['a'])).toThrow(SharedExpenseAmountInvalidError);
		expect(() => create(0, ['a'])).toThrow(SharedExpenseAmountNonPositiveError);
		expect(() => create(5, [])).toThrow(SharedExpenseParticipantsMissingError);
		expect(() => create(5, ['a', 'a'])).toThrow(SharedExpenseParticipantsDuplicateError);
		expect(() =>
			SharedExpense.create({
				actor: { kind: 'unknown' },
				amountMinor: 1,
				bookId: 'book-a',
				description: 'Test',
				id: 'expense-2',
				participants: [participant('a', 'book-b')],
			})
		).toThrow(SharedExpenseParticipantBookMismatchError);
		expect(() =>
			SharedExpense.create({
				actor: { kind: 'unknown' },
				amountMinor: 1,
				bookId: 'book-a',
				description: 'Test',
				id: 'expense-2',
				participants: [
					SharedExpenseParticipant.create({
						bookId: 'book-a',
						id: 'removed',
						name: 'Removed',
						removedAt: 'yesterday',
					}),
				],
			})
		).toThrow(SharedExpenseParticipantInactiveError);
	});
});
