import { FinancialTransactionMother } from '@modules/ledger/domain/transaction.mother';
import { MockLedgerRepository } from '@modules/ledger/infrastructure/repositories/mock-ledger.repository';
import { afterEach, describe, expect, it, setSystemTime } from 'bun:test';

import {
	ScheduleAmountInvalidError,
	ScheduleDateRangeInvalidError,
	ScheduleNotFoundError,
	ScheduleOccurrenceGenerationLimitInvalidError,
	ScheduleOccurrenceGenerationThroughDateInvalidError,
	ScheduleOccurrenceIdentityConflictError,
	ScheduleOccurrenceLedgerTransactionMismatchError,
	ScheduleOccurrenceLedgerTransactionNotFoundError,
	ScheduleOccurrenceNotFoundError,
	ScheduleOccurrenceRecordInvalidError,
	ScheduleTransitionInvalidError,
} from '../domain';
import { ScheduledPaymentMother } from '../domain/schedule.mother';
import { ScheduleOccurrenceMother } from '../domain/schedule-occurrence.mother';
import { MockScheduleRepository } from '../infrastructure/repositories/mock-schedule.repository';
import { MockScheduleOccurrenceRepository } from '../infrastructure/repositories/mock-schedule-occurrence.repository';
import {
	ChangeScheduleStatus,
	CreateSchedule,
	GenerateScheduleOccurrences,
	ListScheduleOccurrences,
	ListSchedules,
	RecordScheduleOccurrence,
	UpdateSchedule,
} from './schedule.use-cases';

afterEach(() => {
	setSystemTime();
});

describe('CreateSchedule', () => {
	describe('execute', () => {
		it('should save and return an active schedule created at the given time', () => {
			const schedules = new MockScheduleRepository();
			const useCase = new CreateSchedule(schedules);

			const schedule = useCase.execute(
				{
					accountId: 'account-1',
					amountMinor: -1250,
					bookId: 'book-1',
					frequency: 'monthly',
					id: 'schedule-1',
					startDate: '2025-01-31',
				},
				'2025-01-01T00:00:00.000Z'
			);

			expect(schedule).toMatchObject({
				createdAt: '2025-01-01T00:00:00.000Z',
				id: 'schedule-1',
				status: 'active',
			});
			schedules.assertSaveHasBeenCalledWith(schedule);
		});

		it('should default the creation time to now', () => {
			setSystemTime(new Date('2025-06-01T10:00:00.000Z'));
			const schedules = new MockScheduleRepository();
			const useCase = new CreateSchedule(schedules);

			const schedule = useCase.execute({
				accountId: 'account-1',
				amountMinor: -1250,
				bookId: 'book-1',
				frequency: 'weekly',
				id: 'schedule-1',
				startDate: '2025-01-31',
			});

			expect(schedule.createdAt).toBe('2025-06-01T10:00:00.000Z');
		});

		it('should throw ScheduleAmountInvalidError without saving when the amount is zero', () => {
			const schedules = new MockScheduleRepository();
			const useCase = new CreateSchedule(schedules);

			expect(() =>
				useCase.execute({
					accountId: 'account-1',
					amountMinor: 0,
					bookId: 'book-1',
					frequency: 'monthly',
					id: 'schedule-1',
					startDate: '2025-01-31',
				})
			).toThrow(ScheduleAmountInvalidError);
			schedules.assertSaveHasNotBeenCalled();
		});
	});
});

describe('ListSchedules', () => {
	describe('execute', () => {
		it('should return the schedules of the book', () => {
			const schedules = new MockScheduleRepository();
			const stored = [ScheduledPaymentMother.create()];
			schedules.shouldSearch(stored);
			const useCase = new ListSchedules(schedules);

			expect(useCase.execute('book-1')).toEqual(stored);
			schedules.assertSearchHasBeenCalledWith({ bookId: 'book-1' });
		});
	});
});

describe('ListScheduleOccurrences', () => {
	describe('execute', () => {
		it('should return the occurrences of an existing schedule', () => {
			const schedules = new MockScheduleRepository();
			const occurrences = new MockScheduleOccurrenceRepository();
			const stored = [ScheduleOccurrenceMother.create()];
			schedules.shouldFind(ScheduledPaymentMother.create());
			occurrences.shouldSearch(stored);
			const useCase = new ListScheduleOccurrences(schedules, occurrences);

			expect(useCase.execute('book-1', 'schedule-1')).toEqual(stored);
			schedules.assertFindHasBeenCalledWith({ bookId: 'book-1', id: 'schedule-1' });
			occurrences.assertSearchHasBeenCalledWith({ bookId: 'book-1', scheduleId: 'schedule-1' });
		});

		it('should throw ScheduleNotFoundError when the schedule does not exist', () => {
			const useCase = new ListScheduleOccurrences(
				new MockScheduleRepository(),
				new MockScheduleOccurrenceRepository()
			);

			expect(() => useCase.execute('book-1', 'missing')).toThrow(ScheduleNotFoundError);
		});
	});
});

describe('UpdateSchedule', () => {
	describe('execute', () => {
		it('should save and return the updated schedule', () => {
			const schedules = new MockScheduleRepository();
			schedules.shouldFind(ScheduledPaymentMother.create());
			const useCase = new UpdateSchedule(schedules);

			const updated = useCase.execute('book-1', 'schedule-1', { memo: 'Rent', payee: 'Landlord' });

			expect(updated).toMatchObject({ id: 'schedule-1', memo: 'Rent', payee: 'Landlord' });
			schedules.assertSaveHasBeenCalledWith(updated);
		});

		it('should throw ScheduleNotFoundError without saving when the schedule does not exist', () => {
			const schedules = new MockScheduleRepository();
			const useCase = new UpdateSchedule(schedules);

			expect(() => useCase.execute('book-1', 'missing', { memo: 'Rent' })).toThrow(ScheduleNotFoundError);
			schedules.assertSaveHasNotBeenCalled();
		});

		it('should throw the domain error without saving when the changes are invalid', () => {
			const schedules = new MockScheduleRepository();
			schedules.shouldFind(ScheduledPaymentMother.create());
			const useCase = new UpdateSchedule(schedules);

			expect(() => useCase.execute('book-1', 'schedule-1', { endDate: '2024-12-31' })).toThrow(
				ScheduleDateRangeInvalidError
			);
			schedules.assertSaveHasNotBeenCalled();
		});
	});
});

describe('ChangeScheduleStatus', () => {
	describe('execute', () => {
		it('should save and return the schedule with the new status', () => {
			const schedules = new MockScheduleRepository();
			schedules.shouldFind(ScheduledPaymentMother.create());
			const useCase = new ChangeScheduleStatus(schedules);

			const paused = useCase.execute('book-1', 'schedule-1', 'paused');

			expect(paused.status).toBe('paused');
			schedules.assertSaveHasBeenCalledWith(paused);
		});

		it('should throw ScheduleNotFoundError without saving when the schedule does not exist', () => {
			const schedules = new MockScheduleRepository();
			const useCase = new ChangeScheduleStatus(schedules);

			expect(() => useCase.execute('book-1', 'missing', 'paused')).toThrow(ScheduleNotFoundError);
			schedules.assertSaveHasNotBeenCalled();
		});

		it('should throw ScheduleTransitionInvalidError without saving when the transition is not allowed', () => {
			const schedules = new MockScheduleRepository();
			schedules.shouldFind(ScheduledPaymentMother.create().transitionTo('canceled'));
			const useCase = new ChangeScheduleStatus(schedules);

			expect(() => useCase.execute('book-1', 'schedule-1', 'active')).toThrow(ScheduleTransitionInvalidError);
			schedules.assertSaveHasNotBeenCalled();
		});
	});
});

describe('GenerateScheduleOccurrences', () => {
	const createIdFactory = (): (() => string) => {
		let next = 0;

		return () => `generated-${String((next += 1))}`;
	};

	describe('execute', () => {
		it('should generate the pending occurrences due through the given date', () => {
			const schedules = new MockScheduleRepository();
			const occurrences = new MockScheduleOccurrenceRepository();
			schedules.shouldFind(ScheduledPaymentMother.create());
			const useCase = new GenerateScheduleOccurrences(schedules, occurrences, createIdFactory());

			const generated = useCase.execute('book-1', 'schedule-1', '2025-03-31');

			expect(generated.map(({ dueDate, id, occurrenceNumber }) => ({ dueDate, id, occurrenceNumber }))).toEqual([
				{ dueDate: '2025-01-31', id: 'generated-1', occurrenceNumber: 0 },
				{ dueDate: '2025-02-28', id: 'generated-2', occurrenceNumber: 1 },
				{ dueDate: '2025-03-31', id: 'generated-3', occurrenceNumber: 2 },
			]);
			for (const occurrence of generated) {
				occurrences.assertSaveHasBeenCalledWith(occurrence);
			}
			occurrences.assertSaveHasBeenCalledTimes(3);
			schedules.assertSaveHasNotBeenCalled();
		});

		it('should use random identifiers by default', () => {
			const schedules = new MockScheduleRepository();
			const occurrences = new MockScheduleOccurrenceRepository();
			schedules.shouldFind(ScheduledPaymentMother.create());
			const useCase = new GenerateScheduleOccurrences(schedules, occurrences);

			const [first, second] = useCase.execute('book-1', 'schedule-1', '2025-02-28');

			expect(first.id).not.toBe('');
			expect(first.id).not.toBe(second.id);
		});

		it('should continue after the latest existing occurrence', () => {
			const schedules = new MockScheduleRepository();
			const occurrences = new MockScheduleOccurrenceRepository();
			const schedule = ScheduledPaymentMother.create();
			schedules.shouldFind(schedule);
			occurrences.shouldSearch([ScheduleOccurrenceMother.create(schedule, 0, 'existing')]);
			const useCase = new GenerateScheduleOccurrences(schedules, occurrences, createIdFactory());

			const generated = useCase.execute('book-1', 'schedule-1', '2025-02-28');

			expect(generated.map(occurrence => occurrence.occurrenceNumber)).toEqual([1]);
			occurrences.assertSearchHasBeenCalledWith({ bookId: 'book-1', scheduleId: 'schedule-1' });
		});

		it('should generate nothing when no occurrence is due yet', () => {
			const schedules = new MockScheduleRepository();
			const occurrences = new MockScheduleOccurrenceRepository();
			schedules.shouldFind(ScheduledPaymentMother.create());
			const useCase = new GenerateScheduleOccurrences(schedules, occurrences, createIdFactory());

			expect(useCase.execute('book-1', 'schedule-1', '2025-01-30')).toEqual([]);
			occurrences.assertSaveHasNotBeenCalled();
		});

		it('should stop at the maximum number of occurrences', () => {
			const schedules = new MockScheduleRepository();
			const occurrences = new MockScheduleOccurrenceRepository();
			schedules.shouldFind(ScheduledPaymentMother.create());
			const useCase = new GenerateScheduleOccurrences(schedules, occurrences, createIdFactory());

			const generated = useCase.execute('book-1', 'schedule-1', '2025-12-31', 2);

			expect(generated).toHaveLength(2);
			occurrences.assertSaveHasBeenCalledTimes(2);
		});

		it('should complete the schedule after generating its last occurrence', () => {
			const schedules = new MockScheduleRepository();
			const occurrences = new MockScheduleOccurrenceRepository();
			const schedule = ScheduledPaymentMother.create({ occurrenceLimit: 2 });
			schedules.shouldFind(schedule);
			const useCase = new GenerateScheduleOccurrences(schedules, occurrences, createIdFactory());

			const generated = useCase.execute('book-1', 'schedule-1', '2025-12-31');

			expect(generated).toHaveLength(2);
			schedules.assertSaveHasBeenCalledTimes(1);
			schedules.assertSaveHasBeenCalledWith(schedule.transitionTo('completed'));
		});

		it('should complete an active schedule whose occurrences were already all generated', () => {
			const schedules = new MockScheduleRepository();
			const occurrences = new MockScheduleOccurrenceRepository();
			const schedule = ScheduledPaymentMother.create({ frequency: 'one_time' });
			schedules.shouldFind(schedule);
			occurrences.shouldSearch([ScheduleOccurrenceMother.create(schedule, 0, 'existing')]);
			const useCase = new GenerateScheduleOccurrences(schedules, occurrences, createIdFactory());

			expect(useCase.execute('book-1', 'schedule-1', '2025-12-31')).toEqual([]);
			schedules.assertSaveHasBeenCalledWith(schedule.transitionTo('completed'));
			occurrences.assertSaveHasNotBeenCalled();
		});

		it('should return nothing when the schedule is not active', () => {
			const schedules = new MockScheduleRepository();
			const occurrences = new MockScheduleOccurrenceRepository();
			schedules.shouldFind(ScheduledPaymentMother.create().transitionTo('paused'));
			const useCase = new GenerateScheduleOccurrences(schedules, occurrences, createIdFactory());

			expect(useCase.execute('book-1', 'schedule-1', '2025-12-31')).toEqual([]);
			occurrences.assertSaveHasNotBeenCalled();
		});

		it('should skip occurrences created concurrently when an identity conflict is detected', () => {
			const schedules = new MockScheduleRepository();
			const occurrences = new MockScheduleOccurrenceRepository();
			const schedule = ScheduledPaymentMother.create();
			schedules.shouldFind(schedule);
			occurrences.shouldSearchOnce([]);
			occurrences.shouldSearchOnce([ScheduleOccurrenceMother.create(schedule, 0, 'concurrent')]);
			occurrences.shouldFailSaveOnce(new ScheduleOccurrenceIdentityConflictError());
			const useCase = new GenerateScheduleOccurrences(schedules, occurrences, createIdFactory());

			const generated = useCase.execute('book-1', 'schedule-1', '2025-02-28');

			expect(generated.map(occurrence => occurrence.occurrenceNumber)).toEqual([1]);
			occurrences.assertSaveHasBeenCalledTimes(2);
		});

		it('should rethrow an identity conflict that does not advance the occurrence number', () => {
			const schedules = new MockScheduleRepository();
			const occurrences = new MockScheduleOccurrenceRepository();
			schedules.shouldFind(ScheduledPaymentMother.create());
			occurrences.shouldFailSave(new ScheduleOccurrenceIdentityConflictError());
			const useCase = new GenerateScheduleOccurrences(schedules, occurrences, createIdFactory());

			expect(() => useCase.execute('book-1', 'schedule-1', '2025-02-28')).toThrow(
				ScheduleOccurrenceIdentityConflictError
			);
		});

		it('should rethrow unexpected save errors', () => {
			const schedules = new MockScheduleRepository();
			const occurrences = new MockScheduleOccurrenceRepository();
			schedules.shouldFind(ScheduledPaymentMother.create());
			occurrences.shouldFailSave(new Error('database unavailable'));
			const useCase = new GenerateScheduleOccurrences(schedules, occurrences, createIdFactory());

			expect(() => useCase.execute('book-1', 'schedule-1', '2025-02-28')).toThrow('database unavailable');
		});

		it.each(['2025-02-30', '2025/01/31', '0000-01-01', 'not-a-date', ''])(
			'should throw ScheduleOccurrenceGenerationThroughDateInvalidError for the date "%s"',
			throughDate => {
				const schedules = new MockScheduleRepository();
				const occurrences = new MockScheduleOccurrenceRepository();
				schedules.shouldFind(ScheduledPaymentMother.create());
				const useCase = new GenerateScheduleOccurrences(schedules, occurrences, createIdFactory());

				expect(() => useCase.execute('book-1', 'schedule-1', throughDate)).toThrow(
					ScheduleOccurrenceGenerationThroughDateInvalidError
				);
				occurrences.assertSaveHasNotBeenCalled();
			}
		);

		it.each([0, -1, 501, 1.5, NaN])(
			'should throw ScheduleOccurrenceGenerationLimitInvalidError for the limit %p',
			maxOccurrences => {
				const schedules = new MockScheduleRepository();
				const occurrences = new MockScheduleOccurrenceRepository();
				schedules.shouldFind(ScheduledPaymentMother.create());
				const useCase = new GenerateScheduleOccurrences(schedules, occurrences, createIdFactory());

				expect(() => useCase.execute('book-1', 'schedule-1', '2025-12-31', maxOccurrences)).toThrow(
					ScheduleOccurrenceGenerationLimitInvalidError
				);
				occurrences.assertSaveHasNotBeenCalled();
			}
		);

		it('should throw ScheduleNotFoundError when the schedule does not exist', () => {
			const occurrences = new MockScheduleOccurrenceRepository();
			const useCase = new GenerateScheduleOccurrences(
				new MockScheduleRepository(),
				occurrences,
				createIdFactory()
			);

			expect(() => useCase.execute('book-1', 'missing', '2025-12-31')).toThrow(ScheduleNotFoundError);
			occurrences.assertSaveHasNotBeenCalled();
		});
	});
});

describe('RecordScheduleOccurrence', () => {
	const setup = () => {
		const schedules = new MockScheduleRepository();
		const occurrences = new MockScheduleOccurrenceRepository();
		const ledger = new MockLedgerRepository();
		const schedule = ScheduledPaymentMother.create();
		const occurrence = ScheduleOccurrenceMother.create(schedule);
		const transaction = FinancialTransactionMother.create({ id: 'transaction-1' });
		const useCase = new RecordScheduleOccurrence(schedules, occurrences, ledger);

		return { ledger, occurrence, occurrences, schedule, schedules, transaction, useCase };
	};

	describe('execute', () => {
		it('should link the occurrence to the ledger transaction and return the persisted occurrence', () => {
			const { ledger, occurrence, occurrences, schedule, schedules, transaction, useCase } = setup();
			const recorded = occurrence.record(transaction, '2025-02-01T09:00:00.000Z');
			schedules.shouldFind(schedule);
			ledger.shouldFind(transaction);
			occurrences.shouldFindOnce(occurrence);
			occurrences.shouldFindOnce(recorded);

			const persisted = useCase.execute('book-1', 'occurrence-1', 'transaction-1', '2025-02-01T09:00:00.000Z');

			expect(persisted).toBe(recorded);
			occurrences.assertFindHasBeenCalledWith({ bookId: 'book-1', id: 'occurrence-1' });
			schedules.assertFindHasBeenCalledWith({ bookId: 'book-1', id: 'schedule-1' });
			ledger.assertFindHasBeenCalledWith('book-1', 'transaction-1');
			occurrences.assertSaveHasBeenCalledWith(recorded);
		});

		it('should default the recording time to now', () => {
			setSystemTime(new Date('2025-02-01T09:00:00.000Z'));
			const { ledger, occurrence, occurrences, schedule, schedules, transaction, useCase } = setup();
			const recorded = occurrence.record(transaction, '2025-02-01T09:00:00.000Z');
			schedules.shouldFind(schedule);
			ledger.shouldFind(transaction);
			occurrences.shouldFindOnce(occurrence);
			occurrences.shouldFindOnce(recorded);

			useCase.execute('book-1', 'occurrence-1', 'transaction-1');

			occurrences.assertSaveHasBeenCalledWith(recorded);
		});

		it('should throw ScheduleOccurrenceNotFoundError when the occurrence does not exist', () => {
			const { occurrences, useCase } = setup();

			expect(() => useCase.execute('book-1', 'missing', 'transaction-1')).toThrow(
				ScheduleOccurrenceNotFoundError
			);
			occurrences.assertSaveHasNotBeenCalled();
		});

		it('should throw ScheduleNotFoundError when the schedule of the occurrence does not exist', () => {
			const { occurrence, occurrences, useCase } = setup();
			occurrences.shouldFind(occurrence);

			expect(() => useCase.execute('book-1', 'occurrence-1', 'transaction-1')).toThrow(ScheduleNotFoundError);
			occurrences.assertSaveHasNotBeenCalled();
		});

		it('should throw ScheduleOccurrenceLedgerTransactionNotFoundError when the transaction does not exist', () => {
			const { occurrence, occurrences, schedule, schedules, useCase } = setup();
			occurrences.shouldFind(occurrence);
			schedules.shouldFind(schedule);

			expect(() => useCase.execute('book-1', 'occurrence-1', 'missing')).toThrow(
				ScheduleOccurrenceLedgerTransactionNotFoundError
			);
			occurrences.assertSaveHasNotBeenCalled();
		});

		it('should throw ScheduleOccurrenceLedgerTransactionMismatchError when the account differs', () => {
			const { ledger, occurrence, occurrences, schedule, schedules, useCase } = setup();
			occurrences.shouldFind(occurrence);
			schedules.shouldFind(schedule);
			ledger.shouldFind(FinancialTransactionMother.create({ accountId: 'account-2' }));

			expect(() => useCase.execute('book-1', 'occurrence-1', 'transaction-1')).toThrow(
				ScheduleOccurrenceLedgerTransactionMismatchError
			);
			occurrences.assertSaveHasNotBeenCalled();
		});

		it('should throw ScheduleOccurrenceLedgerTransactionMismatchError when the amount differs', () => {
			const { ledger, occurrence, occurrences, schedule, schedules, useCase } = setup();
			occurrences.shouldFind(occurrence);
			schedules.shouldFind(schedule);
			ledger.shouldFind(FinancialTransactionMother.create({ amountMinor: -999 }));

			expect(() => useCase.execute('book-1', 'occurrence-1', 'transaction-1')).toThrow(
				ScheduleOccurrenceLedgerTransactionMismatchError
			);
			occurrences.assertSaveHasNotBeenCalled();
		});

		it('should throw ScheduleOccurrenceRecordInvalidError when the transaction belongs to another book', () => {
			const { ledger, occurrence, occurrences, schedule, schedules, useCase } = setup();
			occurrences.shouldFind(occurrence);
			schedules.shouldFind(schedule);
			ledger.shouldFind(FinancialTransactionMother.create({ bookId: 'book-2' }));

			expect(() => useCase.execute('book-1', 'occurrence-1', 'transaction-1')).toThrow(
				ScheduleOccurrenceRecordInvalidError
			);
			occurrences.assertSaveHasNotBeenCalled();
		});

		it('should throw ScheduleOccurrenceNotFoundError when the recorded occurrence cannot be read back', () => {
			const { ledger, occurrence, occurrences, schedule, schedules, transaction, useCase } = setup();
			schedules.shouldFind(schedule);
			ledger.shouldFind(transaction);
			occurrences.shouldFindOnce(occurrence);
			occurrences.shouldFindOnce(undefined);

			expect(() =>
				useCase.execute('book-1', 'occurrence-1', 'transaction-1', '2025-02-01T09:00:00.000Z')
			).toThrow(ScheduleOccurrenceNotFoundError);
			occurrences.assertSaveHasBeenCalledTimes(1);
		});
	});
});
