import { Currency } from '@modules/money/domain';

import {
	BudgetActualAmountInvalidError,
	BudgetAmountOutOfRangeError,
	BudgetDateInvalidError,
	BudgetIdentifierInvalidError,
	BudgetNameInvalidError,
	BudgetPeriodInvalidError,
	BudgetPlannedAmountInvalidError,
} from './budget.error';

/* eslint-disable unicorn/no-null -- Unscoped classifications are represented as null in budget records. */
const BUDGET_ACTUAL_STATUSES = ['cleared', 'reconciled'] as const;

type BudgetActualStatus = (typeof BUDGET_ACTUAL_STATUSES)[number];

interface BudgetInput {
	accountId: string;
	bookId: string;
	categoryId?: null | string;
	classId?: null | string;
	currencyCode: string;
	id: string;
	name: string;
	periodEnd: string;
	periodStart: string;
	plannedMinor: number;
}

interface BudgetReport {
	actualMinor: number;
	budget: Budget;
	remainingMinor: number;
}

function assertIdentifier(value: string, label: string): void {
	if (value.trim().length === 0) {
		throw new BudgetIdentifierInvalidError(label);
	}
}

function validateDate(value: string, label: string): void {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		throw new BudgetDateInvalidError(label, 'must use YYYY-MM-DD format');
	}
	const date = new Date(`${value}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
		throw new BudgetDateInvalidError(label, 'must be a valid calendar date');
	}
}

class Budget {
	private constructor(
		readonly accountId: string,
		readonly bookId: string,
		readonly categoryId: null | string,
		readonly classId: null | string,
		readonly currencyCode: string,
		readonly id: string,
		readonly name: string,
		readonly periodEnd: string,
		readonly periodStart: string,
		readonly plannedMinor: number
	) {}

	static create(input: BudgetInput): Budget {
		assertIdentifier(input.id, 'Budget id');
		assertIdentifier(input.bookId, 'Budget book id');
		assertIdentifier(input.accountId, 'Budget account id');
		if (input.categoryId !== undefined && input.categoryId !== null) {
			assertIdentifier(input.categoryId, 'Budget category id');
		}
		if (input.classId !== undefined && input.classId !== null) {
			assertIdentifier(input.classId, 'Budget class id');
		}

		const name = input.name.trim();
		if (name.length === 0 || name.length > 80) {
			throw new BudgetNameInvalidError();
		}

		validateDate(input.periodStart, 'Budget start date');
		validateDate(input.periodEnd, 'Budget end date');
		if (input.periodStart > input.periodEnd) {
			throw new BudgetPeriodInvalidError();
		}

		if (!Number.isSafeInteger(input.plannedMinor)) {
			throw new BudgetPlannedAmountInvalidError('must be a safe integer');
		}
		if (input.plannedMinor < 0) {
			throw new BudgetPlannedAmountInvalidError('must not be negative');
		}

		return new this(
			input.accountId,
			input.bookId,
			input.categoryId ?? null,
			input.classId ?? null,
			Currency.create(input.currencyCode).code,
			input.id,
			name,
			input.periodEnd,
			input.periodStart,
			input.plannedMinor
		);
	}

	static restore(input: BudgetInput): Budget {
		return this.create(input);
	}

	report(actualMinor: bigint): BudgetReport {
		if (actualMinor < 0n) {
			throw new BudgetActualAmountInvalidError();
		}

		const actual = this.toSafeMinorUnits(actualMinor, 'actual');
		const remaining = this.toSafeMinorUnits(BigInt(this.plannedMinor) - actualMinor, 'remaining');

		return { actualMinor: actual, budget: this, remainingMinor: remaining };
	}

	private toSafeMinorUnits(value: bigint, amount: string): number {
		const result = Number(value);
		if (!Number.isSafeInteger(result)) {
			throw new BudgetAmountOutOfRangeError(amount);
		}

		return result;
	}
}

export { Budget, BUDGET_ACTUAL_STATUSES, type BudgetActualStatus, type BudgetInput, type BudgetReport };
