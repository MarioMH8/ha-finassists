import { describe, expect, it } from 'bun:test';

import { SharedExpenseParticipant } from './participant';
import {
	SharedExpenseParticipantBookIdInvalidError,
	SharedExpenseParticipantIdInvalidError,
	SharedExpenseParticipantNameInvalidError,
} from './participant.error';

describe('SharedExpenseParticipant', () => {
	it('creates a normalized immutable participant entity', () => {
		const participant = SharedExpenseParticipant.create({
			bookId: ' book-a ',
			createdAt: '2026-01-02T03:04:05.000Z',
			id: ' participant-1 ',
			name: '  Sam  ',
		});

		expect(participant).toBeInstanceOf(SharedExpenseParticipant);
		expect(participant).toEqual({
			bookId: 'book-a',
			createdAt: '2026-01-02T03:04:05.000Z',
			id: 'participant-1',
			name: 'Sam',
		});
	});

	it('rejects blank participant and book identifiers after trimming', () => {
		expect(() => SharedExpenseParticipant.create({ bookId: 'book-a', id: ' ', name: 'Sam' })).toThrow(
			SharedExpenseParticipantIdInvalidError
		);
		expect(() => SharedExpenseParticipant.create({ bookId: '  ', id: 'participant-1', name: 'Sam' })).toThrow(
			SharedExpenseParticipantBookIdInvalidError
		);
	});

	it('limits trimmed names to 120 characters', () => {
		expect(() => SharedExpenseParticipant.create({ bookId: 'book-a', id: 'p1', name: '  ' })).toThrow(
			SharedExpenseParticipantNameInvalidError
		);
		expect(() =>
			SharedExpenseParticipant.create({ bookId: 'book-a', id: 'p1', name: ` ${'x'.repeat(121)} ` })
		).toThrow(SharedExpenseParticipantNameInvalidError);
		expect(SharedExpenseParticipant.create({ bookId: 'book-a', id: 'p1', name: ` ${'x'.repeat(120)} ` }).name).toBe(
			'x'.repeat(120)
		);
	});

	it('restores persisted participants while retaining removal history and persisted shape', () => {
		const participant = SharedExpenseParticipant.restore({
			bookId: 'book-a',
			createdAt: '2026-01-02T03:04:05.000Z',
			id: 'participant-1',
			name: 'Sam',
			removedAt: '2026-02-03T04:05:06.000Z',
		});

		expect(participant).toBeInstanceOf(SharedExpenseParticipant);
		expect(JSON.stringify(participant)).toBe(
			'{"bookId":"book-a","createdAt":"2026-01-02T03:04:05.000Z","id":"participant-1","name":"Sam","removedAt":"2026-02-03T04:05:06.000Z"}'
		);
	});
});
