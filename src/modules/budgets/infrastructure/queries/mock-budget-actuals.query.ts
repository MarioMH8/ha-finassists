import type { Budget, BudgetActualsQuery } from '@modules/budgets/domain';
import { expect, mock } from 'bun:test';

export class MockBudgetActualsQuery implements BudgetActualsQuery {
	private readonly actualMinorMock = mock<BudgetActualsQuery['actualMinor']>(() => 0n);

	actualMinor(budget: Budget): bigint {
		return this.actualMinorMock(budget);
	}

	assertActualMinorHasBeenCalledWith(budget: Budget): void {
		expect(this.actualMinorMock).toHaveBeenCalledWith(budget);
	}

	shouldReturnActual(actualMinor: bigint): void {
		this.actualMinorMock.mockReturnValue(actualMinor);
	}
}
