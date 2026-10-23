import type { CreateScheduledPaymentInput } from './schedule';
import { ScheduledPayment } from './schedule';

class ScheduledPaymentMother {
	static create(overrides: Partial<CreateScheduledPaymentInput> = {}): ScheduledPayment {
		return ScheduledPayment.create({
			accountId: 'account-1',
			amountMinor: -1250,
			bookId: 'book-1',
			frequency: 'monthly',
			id: 'schedule-1',
			startDate: '2025-01-31',
			...overrides,
		});
	}
}

export { ScheduledPaymentMother };
