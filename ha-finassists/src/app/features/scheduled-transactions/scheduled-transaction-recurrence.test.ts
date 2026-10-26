import { getCopy } from '@app/i18n';
import { describe, expect, it } from 'bun:test';

import { intervalUnitLabel, recurrenceLabel } from './scheduled-transaction-recurrence';

describe('scheduled transaction recurrence labels', () => {
	it('labels one-time and fixed frequencies in English', () => {
		const copy = getCopy('en');

		expect(recurrenceLabel(copy, 'once', 1)).toBe('Once');
		expect(recurrenceLabel(copy, 'daily', 1)).toBe('Every day');
		expect(recurrenceLabel(copy, 'weekly', 2)).toBe('Every 2 weeks');
		expect(recurrenceLabel(copy, 'monthly', 3)).toBe('Every 3 months');
		expect(recurrenceLabel(copy, 'yearly', 2)).toBe('Every 2 years');
	});

	it('labels intervals in Spanish', () => {
		const copy = getCopy('es');

		expect(recurrenceLabel(copy, 'once', 1)).toBe('Una vez');
		expect(recurrenceLabel(copy, 'monthly', 1)).toBe('Cada mes');
		expect(recurrenceLabel(copy, 'daily', 2)).toBe('Cada 2 días');
		expect(intervalUnitLabel(copy, 'yearly')).toBe('años');
	});
});
