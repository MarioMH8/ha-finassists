import type { Copy } from '@app/i18n';
import { interpolate } from '@app/i18n';

import type { ScheduledTransactionFrequency } from './scheduled-transactions-api';
import { SCHEDULED_TRANSACTION_FREQUENCY } from './scheduled-transactions-api';

function intervalUnitLabel(copy: Copy, frequency: ScheduledTransactionFrequency): string {
	switch (frequency) {
		case SCHEDULED_TRANSACTION_FREQUENCY.DAILY: {
			return copy.scheduledIntervalDays;
		}
		case SCHEDULED_TRANSACTION_FREQUENCY.MONTHLY: {
			return copy.scheduledIntervalMonths;
		}
		case SCHEDULED_TRANSACTION_FREQUENCY.ONCE: {
			return '';
		}
		case SCHEDULED_TRANSACTION_FREQUENCY.WEEKLY: {
			return copy.scheduledIntervalWeeks;
		}
		case SCHEDULED_TRANSACTION_FREQUENCY.YEARLY: {
			return copy.scheduledIntervalYears;
		}
	}
}

function recurrenceLabel(copy: Copy, frequency: ScheduledTransactionFrequency, interval: number): string {
	if (frequency === SCHEDULED_TRANSACTION_FREQUENCY.ONCE) {
		return copy.scheduledRecurrenceOnce;
	}
	const count = Math.max(1, Math.trunc(interval));
	switch (frequency) {
		case SCHEDULED_TRANSACTION_FREQUENCY.DAILY: {
			return count === 1
				? copy.scheduledRecurrenceEveryDay
				: interpolate(copy.scheduledRecurrenceEveryDays, { count });
		}
		case SCHEDULED_TRANSACTION_FREQUENCY.MONTHLY: {
			return count === 1
				? copy.scheduledRecurrenceEveryMonth
				: interpolate(copy.scheduledRecurrenceEveryMonths, { count });
		}
		case SCHEDULED_TRANSACTION_FREQUENCY.WEEKLY: {
			return count === 1
				? copy.scheduledRecurrenceEveryWeek
				: interpolate(copy.scheduledRecurrenceEveryWeeks, { count });
		}
		case SCHEDULED_TRANSACTION_FREQUENCY.YEARLY: {
			return count === 1
				? copy.scheduledRecurrenceEveryYear
				: interpolate(copy.scheduledRecurrenceEveryYears, { count });
		}
	}
}

export { intervalUnitLabel, recurrenceLabel };
