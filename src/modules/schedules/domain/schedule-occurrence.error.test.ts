import { describe, expect, it } from 'bun:test';

import {
	ScheduleOccurrenceAmountInvalidError,
	ScheduleOccurrenceDateInvalidError,
	ScheduleOccurrenceGenerationLimitInvalidError,
	ScheduleOccurrenceGenerationThroughDateInvalidError,
	ScheduleOccurrenceIdentityConflictError,
	ScheduleOccurrenceIdentityInvalidError,
	ScheduleOccurrenceLedgerTransactionMismatchError,
	ScheduleOccurrenceLedgerTransactionNotFoundError,
	ScheduleOccurrenceLinkConflictError,
	ScheduleOccurrenceNotFoundError,
	ScheduleOccurrenceNumberInvalidError,
	ScheduleOccurrenceRecordInvalidError,
	ScheduleOccurrenceStatusInvalidError,
	ScheduleOccurrenceTransitionInvalidError,
	ScheduleOccurrenceUnavailableError,
} from './schedule-occurrence.error';

const ERRORS: [string, Error][] = [
	['ScheduleOccurrenceAmountInvalidError', new ScheduleOccurrenceAmountInvalidError()],
	['ScheduleOccurrenceDateInvalidError', new ScheduleOccurrenceDateInvalidError()],
	['ScheduleOccurrenceGenerationLimitInvalidError', new ScheduleOccurrenceGenerationLimitInvalidError()],
	['ScheduleOccurrenceGenerationThroughDateInvalidError', new ScheduleOccurrenceGenerationThroughDateInvalidError()],
	['ScheduleOccurrenceIdentityConflictError', new ScheduleOccurrenceIdentityConflictError()],
	['ScheduleOccurrenceIdentityInvalidError', new ScheduleOccurrenceIdentityInvalidError()],
	['ScheduleOccurrenceLedgerTransactionMismatchError', new ScheduleOccurrenceLedgerTransactionMismatchError()],
	['ScheduleOccurrenceLedgerTransactionNotFoundError', new ScheduleOccurrenceLedgerTransactionNotFoundError()],
	['ScheduleOccurrenceLinkConflictError', new ScheduleOccurrenceLinkConflictError()],
	['ScheduleOccurrenceNotFoundError', new ScheduleOccurrenceNotFoundError()],
	['ScheduleOccurrenceNumberInvalidError', new ScheduleOccurrenceNumberInvalidError()],
	['ScheduleOccurrenceRecordInvalidError', new ScheduleOccurrenceRecordInvalidError()],
	['ScheduleOccurrenceStatusInvalidError', new ScheduleOccurrenceStatusInvalidError()],
	['ScheduleOccurrenceTransitionInvalidError', new ScheduleOccurrenceTransitionInvalidError('recorded')],
	['ScheduleOccurrenceUnavailableError', new ScheduleOccurrenceUnavailableError()],
];

describe('schedule occurrence errors', () => {
	it.each(ERRORS)('should expose %s with its name and a message', (name, error) => {
		expect(error).toBeInstanceOf(Error);
		expect(error.name).toBe(name);
		expect(error.message).not.toBe('');
	});

	it('should name the status the occurrence cannot transition from', () => {
		expect(new ScheduleOccurrenceTransitionInvalidError('skipped').message).toBe(
			'Cannot transition schedule occurrence from skipped'
		);
	});
});
