/* eslint-disable unicorn/no-null -- Unscoped classifications are represented as null in budget records. */
import { describe, expect, it } from 'bun:test';

import { Budget } from './budget';
import {
	BudgetActualAmountInvalidError,
	BudgetAmountOutOfRangeError,
	BudgetDateInvalidError,
	BudgetIdentifierInvalidError,
	BudgetNameInvalidError,
	BudgetPeriodInvalidError,
	BudgetPlannedAmountInvalidError,
} from './budget.error';
import { BudgetMother } from './budget.mother';

describe('Budget', () => {
	it('creates a normalized budget with unscoped classifications by default', () => {
		const budget = BudgetMother.create({ currencyCode: 'usd', name: ' March ' });

		expect(budget).toMatchObject({
			categoryId: null,
			classId: null,
			currencyCode: 'USD',
			name: 'March',
			plannedMinor: 1000,
		});
	});

	it('restores a persisted budget through the same invariants', () => {
		const budget = BudgetMother.create();
		const restored = Budget.restore({
			accountId: budget.accountId,
			bookId: budget.bookId,
			categoryId: budget.categoryId,
			classId: budget.classId,
			currencyCode: budget.currencyCode,
			id: budget.id,
			name: budget.name,
			periodEnd: budget.periodEnd,
			periodStart: budget.periodStart,
			plannedMinor: budget.plannedMinor,
		});

		expect(restored).toEqual(budget);
	});

	it('rejects invalid identifiers, names, dates, periods and planned amounts with semantic errors', () => {
		expect(() => BudgetMother.create({ id: ' ' })).toThrow(BudgetIdentifierInvalidError);
		expect(() => BudgetMother.create({ name: ' ' })).toThrow(BudgetNameInvalidError);
		expect(() => BudgetMother.create({ periodStart: '2026-02-29' })).toThrow(BudgetDateInvalidError);
		expect(() => BudgetMother.create({ periodStart: '2026-04-01' })).toThrow(BudgetPeriodInvalidError);
		expect(() => BudgetMother.create({ plannedMinor: 0.1 })).toThrow(BudgetPlannedAmountInvalidError);
		expect(() => BudgetMother.create({ plannedMinor: -1 })).toThrow(BudgetPlannedAmountInvalidError);
	});

	it('reports actual and remaining minor units without mutating the budget', () => {
		const budget = BudgetMother.create({ plannedMinor: 1000 });
		const report = budget.report(375n);

		expect(report).toEqual({ actualMinor: 375, budget, remainingMinor: 625 });
		expect(budget.plannedMinor).toBe(1000);
	});

	it('allows overspending while rejecting negative or out-of-range actual amounts', () => {
		const budget = BudgetMother.create({ plannedMinor: 1000 });

		expect(budget.report(1250n).remainingMinor).toBe(-250);
		expect(() => budget.report(-1n)).toThrow(BudgetActualAmountInvalidError);
		expect(() => budget.report(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow(BudgetAmountOutOfRangeError);
	});
});
