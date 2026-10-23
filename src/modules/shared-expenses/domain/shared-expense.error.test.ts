import { describe, expect, it } from 'bun:test';

import {
	SharedExpenseActorIdInvalidError,
	SharedExpenseActorInvalidError,
	SharedExpenseAllocationsInvalidError,
	SharedExpenseAllocationTotalMismatchError,
	SharedExpenseAmountInvalidError,
	SharedExpenseAmountNonPositiveError,
	SharedExpenseBookArchivedError,
	SharedExpenseBookIdInvalidError,
	SharedExpenseBookNotFoundError,
	SharedExpenseDescriptionInvalidError,
	SharedExpenseIdInvalidError,
	SharedExpenseParticipantBookMismatchError,
	SharedExpenseParticipantInactiveError,
	SharedExpenseParticipantsDuplicateError,
	SharedExpenseParticipantsMissingError,
	SharedExpenseSettlementsInvalidError,
	SharedExpenseSettlementStatusInvalidError,
	SharedExpenseSettlementTransitionInvalidError,
	SharedExpenseTransitionInvalidError,
} from './shared-expense.error';

describe('Shared expense errors', () => {
	const cases: [Error, string, string][] = [
		[new SharedExpenseIdInvalidError(), 'SharedExpenseIdInvalidError', 'Shared expense id must not be empty'],
		[
			new SharedExpenseBookIdInvalidError(),
			'SharedExpenseBookIdInvalidError',
			'Shared expense book id must not be empty',
		],
		[new SharedExpenseBookNotFoundError(), 'SharedExpenseBookNotFoundError', 'Book not found'],
		[
			new SharedExpenseBookArchivedError(),
			'SharedExpenseBookArchivedError',
			'Cannot create shared expenses in an archived book',
		],
		[new SharedExpenseActorInvalidError(), 'SharedExpenseActorInvalidError', 'Expense actor kind is not supported'],
		[
			new SharedExpenseActorIdInvalidError(),
			'SharedExpenseActorIdInvalidError',
			'Expense actor id must not be empty',
		],
		[
			new SharedExpenseDescriptionInvalidError(),
			'SharedExpenseDescriptionInvalidError',
			'Shared expense description must contain between 1 and 200 characters',
		],
		[
			new SharedExpenseAmountNonPositiveError(),
			'SharedExpenseAmountNonPositiveError',
			'Expense amount must be greater than zero',
		],
		[
			new SharedExpenseParticipantsMissingError(),
			'SharedExpenseParticipantsMissingError',
			'Shared expense must have at least one participant',
		],
		[
			new SharedExpenseParticipantsDuplicateError(),
			'SharedExpenseParticipantsDuplicateError',
			'Shared expense participants must be unique',
		],
		[
			new SharedExpenseParticipantBookMismatchError(),
			'SharedExpenseParticipantBookMismatchError',
			'Shared expense participants must belong to the same book',
		],
		[
			new SharedExpenseParticipantInactiveError('participant-1'),
			'SharedExpenseParticipantInactiveError',
			'Participant participant-1 is no longer active',
		],
		[
			new SharedExpenseAllocationsInvalidError(),
			'SharedExpenseAllocationsInvalidError',
			'Shared expense allocations are invalid',
		],
		[
			new SharedExpenseAllocationTotalMismatchError(),
			'SharedExpenseAllocationTotalMismatchError',
			'Shared expense allocations must sum to the expense amount',
		],
		[
			new SharedExpenseSettlementsInvalidError(),
			'SharedExpenseSettlementsInvalidError',
			'Each settlement must match its participant allocation',
		],
		[
			new SharedExpenseSettlementStatusInvalidError(),
			'SharedExpenseSettlementStatusInvalidError',
			'Shared expense settlement status is not supported',
		],
		[
			new SharedExpenseTransitionInvalidError('open', 'settled'),
			'SharedExpenseTransitionInvalidError',
			'Cannot transition a open shared expense to settled',
		],
		[
			new SharedExpenseSettlementTransitionInvalidError('participant-1'),
			'SharedExpenseSettlementTransitionInvalidError',
			'Cannot settle participant participant-1 for this shared expense',
		],
	];

	it.each(cases)('should expose name and message for %p', (error, name, message) => {
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe(name);
		expect(error.message).toBe(message);
	});

	it('should expose the amount error as a TypeError', () => {
		const error = new SharedExpenseAmountInvalidError();

		expect(error).toBeInstanceOf(TypeError);
		expect(error.name).toBe('SharedExpenseAmountInvalidError');
		expect(error.message).toBe('Expense minor units must be a safe integer');
	});
});
