import type { ScheduleCriteria, ScheduledPayment, ScheduleRepository } from '@modules/schedules/domain';
import { expect, mock } from 'bun:test';

export class MockScheduleRepository implements ScheduleRepository {
	private readonly findMock = mock<ScheduleRepository['find']>();
	private readonly saveMock = mock<ScheduleRepository['save']>();
	private readonly searchMock = mock<ScheduleRepository['search']>(() => []);

	assertFindHasBeenCalledWith(criteria: ScheduleCriteria): void {
		expect(this.findMock).toHaveBeenCalledWith(criteria);
	}

	assertSaveHasBeenCalledTimes(times: number): void {
		expect(this.saveMock).toHaveBeenCalledTimes(times);
	}

	assertSaveHasBeenCalledWith(schedule: ScheduledPayment): void {
		expect(this.saveMock).toHaveBeenCalledWith(schedule);
	}

	assertSaveHasNotBeenCalled(): void {
		expect(this.saveMock).not.toHaveBeenCalled();
	}

	assertSearchHasBeenCalledWith(criteria?: ScheduleCriteria): void {
		expect(this.searchMock).toHaveBeenCalledWith(...(criteria === undefined ? [] : [criteria]));
	}

	find(criteria: ScheduleCriteria): ScheduledPayment | undefined {
		return this.findMock(criteria);
	}

	save(schedule: ScheduledPayment): void {
		this.saveMock(schedule);
	}

	search(criteria?: ScheduleCriteria): ScheduledPayment[] {
		return criteria === undefined ? this.searchMock() : this.searchMock(criteria);
	}

	shouldFind(schedule: ScheduledPayment | undefined): void {
		this.findMock.mockReturnValue(schedule);
	}

	shouldSearch(schedules: ScheduledPayment[]): void {
		this.searchMock.mockReturnValue(schedules);
	}
}
