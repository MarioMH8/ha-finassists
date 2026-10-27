import {
	ScheduledTransactionAmountInvalidError,
	ScheduledTransactionStartDateInvalidError,
} from '@modules/ledger/domain';
import { describe, expect, it } from 'bun:test';

import type { ScheduledTransactionRow } from './sqlite-scheduled-transaction.mapper';
import { SqliteScheduledTransactionMapper } from './sqlite-scheduled-transaction.mapper';

function row(overrides: Partial<ScheduledTransactionRow> = {}): ScheduledTransactionRow {
	return {
		amount_minor: 1250,
		category_id: null,
		created_at: '2026-05-01T10:00:00.000Z',
		created_by: null,
		currency_code: 'EUR',
		description: 'Rent',
		end_date: null,
		frequency: 'monthly',
		id: 'schedule-1',
		interval: 1,
		kind: 'expense',
		next_due_date: '2026-05-01',
		occurrence_number: 0,
		posting_mode: 'automatic',
		start_date: '2026-05-01',
		status: 'active',
		version: 0,
		...overrides,
	};
}

describe('SqliteScheduledTransactionMapper', () => {
	it('maps every column to the domain scheduled transaction', () => {
		const schedule = SqliteScheduledTransactionMapper.toDomain(row());

		expect(schedule).toMatchObject({
			amountMinor: 1250,
			categoryId: null,
			createdAt: '2026-05-01T10:00:00.000Z',
			createdBy: null,
			currencyCode: 'EUR',
			description: 'Rent',
			endDate: null,
			frequency: 'monthly',
			id: 'schedule-1',
			interval: 1,
			kind: 'expense',
			nextDueDate: '2026-05-01',
			occurrenceNumber: 0,
			postingMode: 'automatic',
			startDate: '2026-05-01',
			status: 'active',
			version: 0,
		});
	});

	it('keeps null category and creator references', () => {
		const schedule = SqliteScheduledTransactionMapper.toDomain(row({ category_id: null, created_by: null }));

		expect(schedule.categoryId).toBeNull();
		expect(schedule.createdBy).toBeNull();
	});

	it('maps the version, occurrence and next due date', () => {
		const schedule = SqliteScheduledTransactionMapper.toDomain(
			row({ next_due_date: '2026-08-01', occurrence_number: 3, version: 7 })
		);

		expect(schedule.nextDueDate).toBe('2026-08-01');
		expect(schedule.occurrenceNumber).toBe(3);
		expect(schedule.version).toBe(7);
	});

	it('maps an end date on a recurring schedule', () => {
		const schedule = SqliteScheduledTransactionMapper.toDomain(row({ end_date: '2026-12-31' }));

		expect(schedule.endDate).toBe('2026-12-31');
	});

	it('maps a completed schedule without a next due date', () => {
		const schedule = SqliteScheduledTransactionMapper.toDomain(
			row({ next_due_date: null, occurrence_number: 3, status: 'completed' })
		);

		expect(schedule.nextDueDate).toBeNull();
		expect(schedule.status).toBe('completed');
	});

	it('maps large amounts exactly', () => {
		const amountMinor = Number.MAX_SAFE_INTEGER;

		expect(SqliteScheduledTransactionMapper.toDomain(row({ amount_minor: amountMinor })).amountMinor).toBe(
			amountMinor
		);
	});

	it('leaves amount validation to the domain', () => {
		expect(() => SqliteScheduledTransactionMapper.toDomain(row({ amount_minor: 0 }))).toThrow(
			ScheduledTransactionAmountInvalidError
		);
	});

	it('leaves date validation to the domain', () => {
		expect(() => SqliteScheduledTransactionMapper.toDomain(row({ start_date: '2026-13-01' }))).toThrow(
			ScheduledTransactionStartDateInvalidError
		);
	});
});
