import type { ScheduledPayment, ScheduleFrequency, ScheduleStatus } from './schedule';

interface ScheduleCriteria {
	accountId?: string;
	amountMinor?: number;
	bookId?: string;
	createdAt?: string;
	endDate?: null | string;
	frequency?: ScheduleFrequency;
	id?: string;
	interval?: number;
	memo?: string;
	occurrenceLimit?: null | number;
	payee?: string;
	startDate?: string;
	status?: ScheduleStatus;
}

interface ScheduleRepository {
	find(criteria: ScheduleCriteria): ScheduledPayment | undefined;
	save(schedule: ScheduledPayment): void;
	search(criteria?: ScheduleCriteria): ScheduledPayment[];
}

export type { ScheduleCriteria, ScheduleRepository };
