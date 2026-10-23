import type { LedgerRepository } from '../../ledger/domain';
import type { CreateScheduledPaymentInput, ScheduledPayment, UpdateScheduledPaymentInput } from '../domain/schedule';
import {
	createScheduledPayment,
	dueDateAtOccurrence,
	SCHEDULE_STATUS,
	transitionScheduleStatus,
	updateScheduledPayment,
} from '../domain/schedule';
import type { ScheduleRepository } from '../domain/schedule.repository';
import type { LedgerTransactionReference, ScheduleOccurrence } from '../domain/schedule-occurrence';
import { createScheduleOccurrence } from '../domain/schedule-occurrence';
import type { ScheduleOccurrenceRepository } from '../domain/schedule-occurrence.repository';

class CreateSchedule {
	constructor(private readonly schedules: ScheduleRepository) {}

	execute(input: CreateScheduledPaymentInput, createdAt?: string): ScheduledPayment {
		const schedule = createScheduledPayment(input, createdAt);
		this.schedules.create(schedule);

		return schedule;
	}
}

class ListSchedules {
	constructor(private readonly schedules: ScheduleRepository) {}

	execute(bookId: string): ScheduledPayment[] {
		return this.schedules.list(bookId);
	}
}

class ListScheduleOccurrences {
	constructor(
		private readonly schedules: ScheduleRepository,
		private readonly occurrences: ScheduleOccurrenceRepository
	) {}

	execute(bookId: string, scheduleId: string): ScheduleOccurrence[] {
		requireSchedule(this.schedules, bookId, scheduleId);

		return this.occurrences.listForSchedule(bookId, scheduleId);
	}
}

class UpdateSchedule {
	constructor(private readonly schedules: ScheduleRepository) {}

	execute(bookId: string, scheduleId: string, changes: UpdateScheduledPaymentInput): ScheduledPayment {
		const existing = requireSchedule(this.schedules, bookId, scheduleId);
		const updated = updateScheduledPayment(existing, changes);
		if (!this.schedules.update(updated)) {
			throw new Error('Schedule could not be updated');
		}

		return updated;
	}
}

class ChangeScheduleStatus {
	constructor(private readonly schedules: ScheduleRepository) {}

	execute(bookId: string, scheduleId: string, status: 'active' | 'canceled' | 'paused'): ScheduledPayment {
		const existing = requireSchedule(this.schedules, bookId, scheduleId);
		const updated = transitionScheduleStatus(existing, status);
		if (!this.schedules.update(updated)) {
			throw new Error('Schedule could not be updated');
		}

		return updated;
	}
}

class GenerateScheduleOccurrences {
	constructor(
		private readonly schedules: ScheduleRepository,
		private readonly occurrences: ScheduleOccurrenceRepository,
		private readonly idFactory: () => string = () => crypto.randomUUID()
	) {}

	execute(bookId: string, scheduleId: string, throughDate: string, maxOccurrences = 100): ScheduleOccurrence[] {
		if (!isCalendarDate(throughDate)) {
			throw new Error('Generation through date must be a valid YYYY-MM-DD calendar date');
		}
		if (!Number.isSafeInteger(maxOccurrences) || maxOccurrences < 1 || maxOccurrences > 500) {
			throw new Error('Generation batch size must be between 1 and 500');
		}

		const schedule = requireSchedule(this.schedules, bookId, scheduleId);
		if (schedule.status !== SCHEDULE_STATUS.ACTIVE) {
			return [];
		}

		const existing = this.occurrences.listForSchedule(bookId, scheduleId);
		let occurrenceNumber =
			existing.reduce((latest, occurrence) => Math.max(latest, occurrence.occurrenceNumber), -1) + 1;
		const generated: ScheduleOccurrence[] = [];

		while (generated.length < maxOccurrences) {
			const dueDate = dueDateAtOccurrence(schedule, occurrenceNumber);
			if (dueDate === undefined) {
				this.schedules.update({ ...schedule, status: SCHEDULE_STATUS.COMPLETED });
				break;
			}
			if (dueDate > throughDate) {
				break;
			}

			const occurrence = createScheduleOccurrence(schedule, occurrenceNumber, dueDate, this.idFactory());
			if (this.occurrences.createIfAbsent(occurrence)) {
				generated.push(occurrence);
				occurrenceNumber += 1;
				if (dueDateAtOccurrence(schedule, occurrenceNumber) === undefined) {
					this.schedules.update({ ...schedule, status: SCHEDULE_STATUS.COMPLETED });
					break;
				}
				continue;
			}

			const refreshed = this.occurrences.listForSchedule(bookId, scheduleId);
			const next = refreshed.reduce((latest, item) => Math.max(latest, item.occurrenceNumber), -1) + 1;
			if (next <= occurrenceNumber) {
				break;
			}
			occurrenceNumber = next;
		}

		return generated;
	}
}

class RecordScheduleOccurrence {
	constructor(
		private readonly schedules: ScheduleRepository,
		private readonly occurrences: ScheduleOccurrenceRepository,
		private readonly ledger: LedgerRepository
	) {}

	execute(bookId: string, occurrenceId: string, transactionId: string, recordedAt?: string): ScheduleOccurrence {
		const occurrence = this.occurrences.find(bookId, occurrenceId);
		if (!occurrence) {
			throw new Error('Occurrence was not found in this book');
		}
		requireSchedule(this.schedules, bookId, occurrence.scheduleId);
		const transaction = this.ledger.find(bookId, transactionId);
		if (!transaction) {
			throw new Error('Ledger transaction was not found in this book');
		}
		if (transaction.accountId !== occurrence.accountId || transaction.amountMinor !== occurrence.amountMinor) {
			throw new Error('Ledger transaction account and amount must match the scheduled occurrence');
		}

		const reference: LedgerTransactionReference = {
			accountId: transaction.accountId,
			amountMinor: transaction.amountMinor,
			bookId: transaction.bookId,
			id: transaction.id,
		};
		const linked = this.occurrences.linkTransaction(
			bookId,
			occurrenceId,
			reference,
			recordedAt ?? new Date().toISOString()
		);
		if (!linked) {
			throw new Error('Occurrence is already recorded or could not be linked');
		}

		return linked;
	}
}

function requireSchedule(repository: ScheduleRepository, bookId: string, scheduleId: string): ScheduledPayment {
	const schedule = repository.find(bookId, scheduleId);
	if (!schedule) {
		throw new Error('Schedule was not found in this book');
	}

	return schedule;
}

function isCalendarDate(value: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		return false;
	}
	const date = new Date(`${value}T00:00:00.000Z`);

	return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && Number(value.slice(0, 4)) > 0;
}

export {
	ChangeScheduleStatus,
	CreateSchedule,
	GenerateScheduleOccurrences,
	ListScheduleOccurrences,
	ListSchedules,
	RecordScheduleOccurrence,
	UpdateSchedule,
};
