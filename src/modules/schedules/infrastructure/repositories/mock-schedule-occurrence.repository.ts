import { expect, mock } from 'bun:test';

import type { ScheduleOccurrence, ScheduleOccurrenceCriteria, ScheduleOccurrenceRepository } from '../../domain';

export class MockScheduleOccurrenceRepository implements ScheduleOccurrenceRepository {
	private readonly findMock = mock<ScheduleOccurrenceRepository['find']>();
	private readonly saveMock = mock<ScheduleOccurrenceRepository['save']>();
	private readonly searchMock = mock<ScheduleOccurrenceRepository['search']>(() => []);

	assertFindHasBeenCalledWith(criteria: ScheduleOccurrenceCriteria): void {
		expect(this.findMock).toHaveBeenCalledWith(criteria);
	}

	assertSaveHasBeenCalledTimes(times: number): void {
		expect(this.saveMock).toHaveBeenCalledTimes(times);
	}

	assertSaveHasBeenCalledWith(occurrence: ScheduleOccurrence): void {
		expect(this.saveMock).toHaveBeenCalledWith(occurrence);
	}

	assertSaveHasNotBeenCalled(): void {
		expect(this.saveMock).not.toHaveBeenCalled();
	}

	assertSearchHasBeenCalledWith(criteria?: ScheduleOccurrenceCriteria): void {
		expect(this.searchMock).toHaveBeenCalledWith(...(criteria === undefined ? [] : [criteria]));
	}

	find(criteria: ScheduleOccurrenceCriteria): ScheduleOccurrence | undefined {
		return this.findMock(criteria);
	}

	save(occurrence: ScheduleOccurrence): void {
		this.saveMock(occurrence);
	}

	search(criteria?: ScheduleOccurrenceCriteria): ScheduleOccurrence[] {
		return criteria === undefined ? this.searchMock() : this.searchMock(criteria);
	}

	shouldFailSave(error: Error): void {
		this.saveMock.mockImplementation(() => {
			throw error;
		});
	}

	shouldFailSaveOnce(error: Error): void {
		this.saveMock.mockImplementationOnce(() => {
			throw error;
		});
	}

	shouldFind(occurrence: ScheduleOccurrence | undefined): void {
		this.findMock.mockReturnValue(occurrence);
	}

	shouldFindOnce(occurrence: ScheduleOccurrence | undefined): void {
		this.findMock.mockReturnValueOnce(occurrence);
	}

	shouldSearch(occurrences: ScheduleOccurrence[]): void {
		this.searchMock.mockReturnValue(occurrences);
	}

	shouldSearchOnce(occurrences: ScheduleOccurrence[]): void {
		this.searchMock.mockReturnValueOnce(occurrences);
	}
}
