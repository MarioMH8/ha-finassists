import { Currency } from '@modules/money/domain';

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

interface Budget {
	accountId: string;
	bookId: string;
	categoryId: null | string;
	classId: null | string;
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

class BudgetPeriodOverlapError extends Error {
	constructor() {
		super('Budget periods cannot overlap for the same account and scope');
		this.name = 'BudgetPeriodOverlapError';
	}
}

function assertIdentifier(value: string, label: string): void {
	if (value.trim().length === 0) {
		throw new Error(`${label} must not be empty`);
	}
}

function assertSafeMinorUnits(value: number, label: string): void {
	if (!Number.isSafeInteger(value)) {
		throw new TypeError(`${label} must be a safe integer`);
	}
}

function validateBudgetDate(value: string, label: string): void {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		throw new Error(`${label} must use YYYY-MM-DD format`);
	}
	const date = new Date(`${value}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
		throw new Error(`${label} must be a valid calendar date`);
	}
}

function createBudget(input: BudgetInput): Budget {
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
		throw new RangeError('Budget name must contain between 1 and 80 characters');
	}

	validateBudgetDate(input.periodStart, 'Budget start date');
	validateBudgetDate(input.periodEnd, 'Budget end date');
	if (input.periodStart > input.periodEnd) {
		throw new RangeError('Budget start date must be on or before its end date');
	}

	assertSafeMinorUnits(input.plannedMinor, 'Budget planned amount');
	if (input.plannedMinor < 0) {
		throw new RangeError('Budget planned amount must not be negative');
	}

	return {
		accountId: input.accountId,
		bookId: input.bookId,
		categoryId: input.categoryId ?? null,
		classId: input.classId ?? null,
		currencyCode: Currency.create(input.currencyCode).code,
		id: input.id,
		name,
		periodEnd: input.periodEnd,
		periodStart: input.periodStart,
		plannedMinor: input.plannedMinor,
	};
}

function safeMinorUnitsFromBigInt(value: bigint, label: string): number {
	const result = Number(value);
	if (!Number.isSafeInteger(result)) {
		throw new RangeError(`${label} exceeds the safe integer range`);
	}

	return result;
}

export {
	type Budget,
	BUDGET_ACTUAL_STATUSES,
	type BudgetActualStatus,
	type BudgetInput,
	BudgetPeriodOverlapError,
	type BudgetReport,
	createBudget,
	safeMinorUnitsFromBigInt,
	validateBudgetDate,
};
