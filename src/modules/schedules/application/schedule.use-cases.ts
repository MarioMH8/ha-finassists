import type { LedgerRepository } from '@modules/ledger/domain';
import type { ScheduleOccurrenceRepository, ScheduleRepository } from '@modules/schedules/domain';
import type { CreateScheduledPaymentInput, UpdateScheduledPaymentInput } from '@modules/schedules/domain/schedule';
import { SCHEDULE_STATUS, ScheduledPayment } from '@modules/schedules/domain/schedule';
import { ScheduleNotFoundError } from '@modules/schedules/domain/schedule.error';
import type { LedgerTransactionReference } from '@modules/schedules/domain/schedule-occurrence';
import { ScheduleOccurrence } from '@modules/schedules/domain/schedule-occurrence';
import {
	ScheduleOccurrenceGenerationLimitInvalidError,
	ScheduleOccurrenceGenerationThroughDateInvalidError,
	ScheduleOccurrenceIdentityConflictError,
	ScheduleOccurrenceLedgerTransactionMismatchError,
	ScheduleOccurrenceLedgerTransactionNotFoundError,
	ScheduleOccurrenceNotFoundError,
} from '@modules/schedules/domain/schedule-occurrence.error';

class CreateSchedule {
	constructor(private readonly schedules: ScheduleRepository) {}

	execute(input: CreateScheduledPaymentInput, createdAt?: string): ScheduledPayment {
		const schedule = ScheduledPayment.create(input, createdAt);
		this.schedules.save(schedule);

		return schedule;
	}
}

class ListSchedules {
	constructor(private readonly schedules: ScheduleRepository) {}

	execute(bookId: string): ScheduledPayment[] {
		return this.schedules.search({ bookId });
	}
}

class ListScheduleOccurrences {
	constructor(
		private readonly schedules: ScheduleRepository,
		private readonly occurrences: ScheduleOccurrenceRepository
	) {}

	execute(bookId: string, scheduleId: string): ScheduleOccurrence[] {
		requireSchedule(this.schedules, bookId, scheduleId);

		return this.occurrences.search({ bookId, scheduleId });
	}
}

class UpdateSchedule {
	constructor(private readonly schedules: ScheduleRepository) {}

	execute(bookId: string, scheduleId: string, changes: UpdateScheduledPaymentInput): ScheduledPayment {
		const existing = requireSchedule(this.schedules, bookId, scheduleId);
		const updated = existing.update(changes);
		this.schedules.save(updated);

		return updated;
	}
}

class ChangeScheduleStatus {
	constructor(private readonly schedules: ScheduleRepository) {}

	execute(bookId: string, scheduleId: string, status: 'active' | 'canceled' | 'paused'): ScheduledPayment {
		const existing = requireSchedule(this.schedules, bookId, scheduleId);
		const updated = existing.transitionTo(status);
		this.schedules.save(updated);

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
			throw new ScheduleOccurrenceGenerationThroughDateInvalidError();
		}
		if (!Number.isSafeInteger(maxOccurrences) || maxOccurrences < 1 || maxOccurrences > 500) {
			throw new ScheduleOccurrenceGenerationLimitInvalidError();
		}

		const schedule = requireSchedule(this.schedules, bookId, scheduleId);
		if (schedule.status !== SCHEDULE_STATUS.ACTIVE) {
			return [];
		}

		const existing = this.occurrences.search({ bookId, scheduleId });
		let occurrenceNumber =
			existing.reduce((latest, occurrence) => Math.max(latest, occurrence.occurrenceNumber), -1) + 1;
		const generated: ScheduleOccurrence[] = [];

		while (generated.length < maxOccurrences) {
			const dueDate = schedule.dueDateAtOccurrence(occurrenceNumber);
			if (dueDate === undefined) {
				this.schedules.save(schedule.transitionTo(SCHEDULE_STATUS.COMPLETED));
				break;
			}
			if (dueDate > throughDate) {
				break;
			}

			const occurrence = ScheduleOccurrence.create(schedule, occurrenceNumber, this.idFactory());
			try {
				this.occurrences.save(occurrence);
				generated.push(occurrence);
				occurrenceNumber += 1;
				if (schedule.dueDateAtOccurrence(occurrenceNumber) === undefined) {
					this.schedules.save(schedule.transitionTo(SCHEDULE_STATUS.COMPLETED));
					break;
				}
				continue;
			} catch (error) {
				if (!(error instanceof ScheduleOccurrenceIdentityConflictError)) {
					throw error;
				}

				const refreshed = this.occurrences.search({ bookId, scheduleId });
				const next = refreshed.reduce((latest, item) => Math.max(latest, item.occurrenceNumber), -1) + 1;
				if (next <= occurrenceNumber) {
					throw error;
				}
				occurrenceNumber = next;
			}
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
		const occurrence = this.occurrences.find({ bookId, id: occurrenceId });
		if (!occurrence) {
			throw new ScheduleOccurrenceNotFoundError();
		}
		requireSchedule(this.schedules, bookId, occurrence.scheduleId);
		const transaction = this.ledger.find(bookId, transactionId);
		if (!transaction) {
			throw new ScheduleOccurrenceLedgerTransactionNotFoundError();
		}
		if (transaction.accountId !== occurrence.accountId || transaction.amountMinor !== occurrence.amountMinor) {
			throw new ScheduleOccurrenceLedgerTransactionMismatchError();
		}

		const reference: LedgerTransactionReference = {
			accountId: transaction.accountId,
			amountMinor: transaction.amountMinor,
			bookId: transaction.bookId,
			id: transaction.id,
		};
		const recorded = occurrence.record(reference, recordedAt ?? new Date().toISOString());
		this.occurrences.save(recorded);
		const persisted = this.occurrences.find({ bookId, id: occurrenceId });
		if (!persisted) {
			throw new ScheduleOccurrenceNotFoundError();
		}

		return persisted;
	}
}

function requireSchedule(repository: ScheduleRepository, bookId: string, scheduleId: string): ScheduledPayment {
	const schedule = repository.find({ bookId, id: scheduleId });
	if (!schedule) {
		throw new ScheduleNotFoundError();
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
