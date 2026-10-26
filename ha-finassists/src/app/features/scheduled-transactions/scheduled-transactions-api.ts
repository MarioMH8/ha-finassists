import { todayIsoDate } from '@app/features/transactions/transaction-dates';
import type { TransactionKind } from '@app/features/transactions/transactions-api';
import { isTransactionKind } from '@app/features/transactions/transactions-api';

const SCHEDULED_TRANSACTION_FREQUENCY = {
	DAILY: 'daily',
	MONTHLY: 'monthly',
	ONCE: 'once',
	WEEKLY: 'weekly',
	YEARLY: 'yearly',
} as const;

type ScheduledTransactionFrequency =
	(typeof SCHEDULED_TRANSACTION_FREQUENCY)[keyof typeof SCHEDULED_TRANSACTION_FREQUENCY];

const SCHEDULED_TRANSACTION_POSTING_MODE = {
	AUTOMATIC: 'automatic',
	MANUAL: 'manual',
} as const;

type ScheduledTransactionPostingMode =
	(typeof SCHEDULED_TRANSACTION_POSTING_MODE)[keyof typeof SCHEDULED_TRANSACTION_POSTING_MODE];

const SCHEDULED_TRANSACTION_STATUS = {
	ACTIVE: 'active',
	COMPLETED: 'completed',
	PAUSED: 'paused',
} as const;

type ScheduledTransactionStatus = (typeof SCHEDULED_TRANSACTION_STATUS)[keyof typeof SCHEDULED_TRANSACTION_STATUS];

interface ScheduledTransaction {
	amountMinor: number;
	categoryId: null | string;
	createdAt: string;
	createdBy: null | string;
	currencyCode: string;
	description: string;
	endDate: null | string;
	frequency: ScheduledTransactionFrequency;
	id: string;
	interval: number;
	kind: TransactionKind;
	nextDueDate: null | string;
	postingMode: ScheduledTransactionPostingMode;
	startDate: string;
	status: ScheduledTransactionStatus;
}

interface ScheduledTransactionPage {
	items: ScheduledTransaction[];
	limit: number;
	offset: number;
	today: string;
	total: number;
}

interface NewScheduledTransaction {
	amountMinor: number;
	categoryId: null | string;
	description: string;
	endDate: null | string;
	frequency: ScheduledTransactionFrequency;
	interval: number;
	kind: TransactionKind;
	postingMode: ScheduledTransactionPostingMode;
	startDate: string;
}

interface ScheduledTransactionUpdate {
	amountMinor?: number;
	categoryId?: null | string;
	description?: string;
	endDate?: null | string;
	frequency?: ScheduledTransactionFrequency;
	interval?: number;
	kind?: TransactionKind;
	postingMode?: ScheduledTransactionPostingMode;
	startDate?: string;
	status?: 'active' | 'paused';
}

interface ScheduledTransactionQuery {
	categoryId?: string;
	dueThrough?: string;
	kind?: TransactionKind;
	limit?: number;
	offset?: number;
	postingMode?: ScheduledTransactionPostingMode;
	search?: string;
	status?: ScheduledTransactionStatus;
}

interface UpcomingScheduledTransaction {
	amountMinor: number;
	categoryId: null | string;
	currencyCode: string;
	description: string;
	dueDate: string;
	kind: TransactionKind;
	postingMode: ScheduledTransactionPostingMode;
	scheduleId: string;
}

interface ScheduledForecast {
	byCategory: {
		expense: Record<string, number>;
		income: Record<string, number>;
	};
	currencyCode: string;
	fromDate: string;
	items: UpcomingScheduledTransaction[];
	limit: number;
	offset: number;
	toDate: string;
	today: string;
	total: number;
	totals: {
		expenseMinor: number;
		incomeMinor: number;
		netMinor: number;
	};
	uncategorized: {
		expenseMinor: number;
		incomeMinor: number;
	};
}

interface ScheduledForecastQuery {
	categoryId?: string;
	fromDate?: string;
	kind?: TransactionKind;
	limit?: number;
	offset?: number;
	toDate?: string;
}

const SCHEDULED_TRANSACTIONS_URL = './api/v1/scheduled-transactions';
const UPCOMING_SCHEDULED_TRANSACTIONS_URL = './api/v1/scheduled-transactions/upcoming';
const MAX_PAGE_SIZE = 100;
const MAX_PAGES = 100;
const FORECAST_PAGE_SIZE = 200;

function isScheduledTransactionFrequency(value: unknown): value is ScheduledTransactionFrequency {
	return Object.values(SCHEDULED_TRANSACTION_FREQUENCY).includes(value as ScheduledTransactionFrequency);
}

function isScheduledTransactionPostingMode(value: unknown): value is ScheduledTransactionPostingMode {
	return Object.values(SCHEDULED_TRANSACTION_POSTING_MODE).includes(value as ScheduledTransactionPostingMode);
}

function isScheduledTransactionStatus(value: unknown): value is ScheduledTransactionStatus {
	return Object.values(SCHEDULED_TRANSACTION_STATUS).includes(value as ScheduledTransactionStatus);
}

function isScheduledTransaction(value: unknown): value is ScheduledTransaction {
	return (
		typeof value === 'object' &&
		value !== null &&
		'id' in value &&
		typeof value.id === 'string' &&
		'kind' in value &&
		isTransactionKind(value.kind) &&
		'amountMinor' in value &&
		typeof value.amountMinor === 'number' &&
		'categoryId' in value &&
		(value.categoryId === null || typeof value.categoryId === 'string') &&
		'currencyCode' in value &&
		typeof value.currencyCode === 'string' &&
		'description' in value &&
		typeof value.description === 'string' &&
		'startDate' in value &&
		typeof value.startDate === 'string' &&
		'frequency' in value &&
		isScheduledTransactionFrequency(value.frequency) &&
		'interval' in value &&
		typeof value.interval === 'number' &&
		'endDate' in value &&
		(value.endDate === null || typeof value.endDate === 'string') &&
		'nextDueDate' in value &&
		(value.nextDueDate === null || typeof value.nextDueDate === 'string') &&
		'postingMode' in value &&
		isScheduledTransactionPostingMode(value.postingMode) &&
		'status' in value &&
		isScheduledTransactionStatus(value.status)
	);
}

function isUpcomingScheduledTransaction(value: unknown): value is UpcomingScheduledTransaction {
	return (
		typeof value === 'object' &&
		value !== null &&
		'scheduleId' in value &&
		typeof value.scheduleId === 'string' &&
		'dueDate' in value &&
		typeof value.dueDate === 'string' &&
		'kind' in value &&
		isTransactionKind(value.kind) &&
		'amountMinor' in value &&
		typeof value.amountMinor === 'number' &&
		'currencyCode' in value &&
		typeof value.currencyCode === 'string' &&
		'description' in value &&
		typeof value.description === 'string' &&
		'categoryId' in value &&
		(value.categoryId === null || typeof value.categoryId === 'string') &&
		'postingMode' in value &&
		isScheduledTransactionPostingMode(value.postingMode)
	);
}

function isScheduledTransactionPage(value: unknown): value is ScheduledTransactionPage {
	return (
		typeof value === 'object' &&
		value !== null &&
		'items' in value &&
		Array.isArray(value.items) &&
		value.items.every((item: unknown) => isScheduledTransaction(item)) &&
		'total' in value &&
		typeof value.total === 'number' &&
		'today' in value &&
		typeof value.today === 'string'
	);
}

function isRecordOfNumbers(value: unknown): value is Record<string, number> {
	return (
		typeof value === 'object' && value !== null && Object.values(value).every(amount => typeof amount === 'number')
	);
}

function isScheduledForecast(value: unknown): value is ScheduledForecast {
	if (typeof value !== 'object' || value === null) {
		return false;
	}
	if (!('items' in value) || !Array.isArray(value.items)) {
		return false;
	}
	if (value.items.some((item: unknown) => !isUpcomingScheduledTransaction(item))) {
		return false;
	}
	if (
		!('totals' in value) ||
		typeof value.totals !== 'object' ||
		value.totals === null ||
		!('expenseMinor' in value.totals) ||
		typeof value.totals.expenseMinor !== 'number' ||
		!('incomeMinor' in value.totals) ||
		typeof value.totals.incomeMinor !== 'number' ||
		!('netMinor' in value.totals) ||
		typeof value.totals.netMinor !== 'number'
	) {
		return false;
	}
	if (!('byCategory' in value) || typeof value.byCategory !== 'object' || value.byCategory === null) {
		return false;
	}
	if (!('expense' in value.byCategory) || !isRecordOfNumbers(value.byCategory.expense)) {
		return false;
	}
	if (!('income' in value.byCategory) || !isRecordOfNumbers(value.byCategory.income)) {
		return false;
	}
	if (
		!('uncategorized' in value) ||
		typeof value.uncategorized !== 'object' ||
		value.uncategorized === null ||
		!('expenseMinor' in value.uncategorized) ||
		typeof value.uncategorized.expenseMinor !== 'number' ||
		!('incomeMinor' in value.uncategorized) ||
		typeof value.uncategorized.incomeMinor !== 'number'
	) {
		return false;
	}

	return (
		'currencyCode' in value &&
		typeof value.currencyCode === 'string' &&
		'fromDate' in value &&
		typeof value.fromDate === 'string' &&
		'toDate' in value &&
		typeof value.toDate === 'string' &&
		'today' in value &&
		typeof value.today === 'string'
	);
}

function queryString(query: Record<string, number | string | undefined>): string {
	const parameters = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value !== undefined) {
			parameters.set(key, String(value));
		}
	}
	const serialized = parameters.toString();

	return serialized ? `?${serialized}` : '';
}

async function fetchScheduledTransactionPage(
	query: ScheduledTransactionQuery,
	signal?: AbortSignal
): Promise<ScheduledTransactionPage> {
	const response = await fetch(`${SCHEDULED_TRANSACTIONS_URL}${queryString({ ...query })}`, {
		headers: { Accept: 'application/json' },
		...(signal && { signal }),
	});
	if (!response.ok) {
		throw new Error(`Scheduled transaction list request failed with HTTP ${String(response.status)}`);
	}
	const page: unknown = await response.json();
	if (!isScheduledTransactionPage(page)) {
		throw new TypeError('Scheduled transaction list response was invalid');
	}

	return page;
}

async function fetchAllScheduledTransactions(
	query: Omit<ScheduledTransactionQuery, 'limit' | 'offset'> = {},
	signal?: AbortSignal
): Promise<{ items: ScheduledTransaction[]; today: string }> {
	const schedules: ScheduledTransaction[] = [];
	let today = '';
	for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
		// Pages depend on the offset reached so far, so they must be fetched sequentially.
		// eslint-disable-next-line no-await-in-loop
		const page = await fetchScheduledTransactionPage(
			{ ...query, limit: MAX_PAGE_SIZE, offset: schedules.length },
			signal
		);
		today = page.today;
		schedules.push(...page.items);
		if (page.items.length === 0 || schedules.length >= page.total) {
			break;
		}
	}

	return { items: schedules, today: today || todayIsoDate() };
}

async function fetchScheduledForecast(
	query: ScheduledForecastQuery = {},
	signal?: AbortSignal
): Promise<ScheduledForecast> {
	const response = await fetch(
		`${UPCOMING_SCHEDULED_TRANSACTIONS_URL}${queryString({ limit: FORECAST_PAGE_SIZE, ...query })}`,
		{
			headers: { Accept: 'application/json' },
			...(signal && { signal }),
		}
	);
	if (!response.ok) {
		throw new Error(`Scheduled forecast request failed with HTTP ${String(response.status)}`);
	}
	const forecast: unknown = await response.json();
	if (!isScheduledForecast(forecast)) {
		throw new TypeError('Scheduled forecast response was invalid');
	}

	return forecast;
}

async function createScheduledTransaction(input: NewScheduledTransaction): Promise<ScheduledTransaction> {
	const response = await fetch(SCHEDULED_TRANSACTIONS_URL, {
		body: JSON.stringify(input),
		headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
		method: 'POST',
	});
	if (!response.ok) {
		throw new Error(`Scheduled transaction creation failed with HTTP ${String(response.status)}`);
	}
	const schedule: unknown = await response.json();
	if (!isScheduledTransaction(schedule)) {
		throw new TypeError('Scheduled transaction response was invalid');
	}

	return schedule;
}

async function updateScheduledTransaction(
	id: string,
	input: ScheduledTransactionUpdate
): Promise<ScheduledTransaction> {
	const response = await fetch(`${SCHEDULED_TRANSACTIONS_URL}/${encodeURIComponent(id)}`, {
		body: JSON.stringify(input),
		headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
		method: 'PATCH',
	});
	if (!response.ok) {
		throw new Error(`Scheduled transaction update failed with HTTP ${String(response.status)}`);
	}
	const schedule: unknown = await response.json();
	if (!isScheduledTransaction(schedule)) {
		throw new TypeError('Scheduled transaction response was invalid');
	}

	return schedule;
}

async function deleteScheduledTransaction(id: string): Promise<void> {
	const response = await fetch(`${SCHEDULED_TRANSACTIONS_URL}/${encodeURIComponent(id)}`, {
		headers: { Accept: 'application/json' },
		method: 'DELETE',
	});
	if (!response.ok) {
		throw new Error(`Scheduled transaction deletion failed with HTTP ${String(response.status)}`);
	}
}

async function postScheduledTransaction(id: string): Promise<ScheduledTransaction> {
	const response = await fetch(`${SCHEDULED_TRANSACTIONS_URL}/${encodeURIComponent(id)}/post`, {
		headers: { Accept: 'application/json' },
		method: 'POST',
	});
	if (!response.ok) {
		throw new Error(`Scheduled transaction posting failed with HTTP ${String(response.status)}`);
	}
	const body: unknown = await response.json();
	if (
		typeof body !== 'object' ||
		body === null ||
		!('scheduledTransaction' in body) ||
		!isScheduledTransaction(body.scheduledTransaction)
	) {
		throw new TypeError('Scheduled transaction response was invalid');
	}

	return body.scheduledTransaction;
}

async function skipScheduledTransaction(id: string): Promise<ScheduledTransaction> {
	const response = await fetch(`${SCHEDULED_TRANSACTIONS_URL}/${encodeURIComponent(id)}/skip`, {
		headers: { Accept: 'application/json' },
		method: 'POST',
	});
	if (!response.ok) {
		throw new Error(`Scheduled transaction skip failed with HTTP ${String(response.status)}`);
	}
	const schedule: unknown = await response.json();
	if (!isScheduledTransaction(schedule)) {
		throw new TypeError('Scheduled transaction response was invalid');
	}

	return schedule;
}

export {
	createScheduledTransaction,
	deleteScheduledTransaction,
	fetchAllScheduledTransactions,
	fetchScheduledForecast,
	fetchScheduledTransactionPage,
	isScheduledTransaction,
	isScheduledTransactionFrequency,
	isScheduledTransactionPostingMode,
	isScheduledTransactionStatus,
	type NewScheduledTransaction,
	postScheduledTransaction,
	SCHEDULED_TRANSACTION_FREQUENCY,
	SCHEDULED_TRANSACTION_POSTING_MODE,
	SCHEDULED_TRANSACTION_STATUS,
	type ScheduledForecast,
	type ScheduledForecastQuery,
	type ScheduledTransaction,
	type ScheduledTransactionFrequency,
	type ScheduledTransactionPage,
	type ScheduledTransactionPostingMode,
	type ScheduledTransactionQuery,
	type ScheduledTransactionStatus,
	type ScheduledTransactionUpdate,
	skipScheduledTransaction,
	type UpcomingScheduledTransaction,
	updateScheduledTransaction,
};
