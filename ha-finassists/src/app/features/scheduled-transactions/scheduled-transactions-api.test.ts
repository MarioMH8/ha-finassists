import { afterEach, describe, expect, test } from 'bun:test';

import type { ScheduledForecast, ScheduledTransaction } from './scheduled-transactions-api';
import {
	createScheduledTransaction,
	deleteScheduledTransaction,
	fetchAllScheduledTransactions,
	fetchScheduledForecast,
	fetchScheduledTransactionPage,
	postScheduledTransaction,
	skipScheduledTransaction,
	updateScheduledTransaction,
} from './scheduled-transactions-api';

interface FetchCall {
	body: string | undefined;
	method: string | undefined;
	url: string;
}

const originalFetch = fetch;
const calls: FetchCall[] = [];

function schedule(overrides: Partial<ScheduledTransaction> = {}): ScheduledTransaction {
	return {
		amountMinor: 1250,
		categoryId: null,
		createdAt: '2026-05-01T10:00:00.000Z',
		createdBy: 'user-1',
		currencyCode: 'EUR',
		description: 'Rent',
		endDate: null,
		frequency: 'monthly',
		id: 'schedule-1',
		interval: 1,
		kind: 'expense',
		nextDueDate: '2026-05-01',
		postingMode: 'automatic',
		startDate: '2026-05-01',
		status: 'active',
		...overrides,
	};
}

function forecast(overrides: Partial<ScheduledForecast> = {}): ScheduledForecast {
	return {
		byCategory: { expense: {}, income: {} },
		currencyCode: 'EUR',
		fromDate: '2026-05-01',
		items: [],
		limit: 100,
		offset: 0,
		toDate: '2026-05-30',
		today: '2026-05-01',
		total: 0,
		totals: { expenseMinor: 0, incomeMinor: 0, netMinor: 0 },
		uncategorized: { expenseMinor: 0, incomeMinor: 0 },
		...overrides,
	};
}

function jsonResponse(body: unknown, status = 200): Response {
	return Response.json(body, { headers: { 'Content-Type': 'application/json' }, status });
}

function mockFetch(handler: (url: string) => Response): void {
	calls.length = 0;
	Object.defineProperty(globalThis, 'fetch', {
		configurable: true,
		value: (input: string, init?: RequestInit): Promise<Response> => {
			calls.push({
				body: typeof init?.body === 'string' ? init.body : undefined,
				method: init?.method,
				url: input,
			});

			return Promise.resolve(handler(input));
		},
		writable: true,
	});
}

async function outcome(promise: Promise<unknown>): Promise<'rejected' | 'resolved'> {
	try {
		await promise;

		return 'resolved';
	} catch {
		return 'rejected';
	}
}

afterEach(() => {
	Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch, writable: true });
});

describe('scheduled transactions api', () => {
	test('lists a page using Ingress-relative URLs and query parameters', async () => {
		mockFetch(() => jsonResponse({ items: [schedule()], limit: 20, offset: 40, today: '2026-05-01', total: 41 }));

		const page = await fetchScheduledTransactionPage({
			kind: 'income',
			limit: 20,
			offset: 40,
			search: 'café',
		});

		expect(page.total).toBe(41);
		expect(page.today).toBe('2026-05-01');
		expect(calls[0]?.url).toBe('./api/v1/scheduled-transactions?kind=income&limit=20&offset=40&search=caf%C3%A9');
	});

	test('loads every page and keeps the server date', async () => {
		mockFetch(url =>
			jsonResponse(
				url.includes('offset=2')
					? { items: [schedule({ id: 'schedule-2' })], today: '2026-05-01', total: 3 }
					: {
							items: [schedule({ id: 'schedule-1' }), schedule({ id: 'schedule-2' })],
							today: '2026-05-01',
							total: 3,
						}
			)
		);

		const result = await fetchAllScheduledTransactions();

		expect(result.items.map(item => item.id)).toEqual(['schedule-1', 'schedule-2', 'schedule-2']);
		expect(result.today).toBe('2026-05-01');
		expect(calls.map(call => call.url)).toEqual([
			'./api/v1/scheduled-transactions?limit=100&offset=0',
			'./api/v1/scheduled-transactions?limit=100&offset=2',
		]);
	});

	test('fetches the forecast with totals and category breakdown', async () => {
		const body = forecast({
			byCategory: { expense: { 'category-1': 1250 }, income: {} },
			total: 1,
			totals: { expenseMinor: 1250, incomeMinor: 0, netMinor: -1250 },
			uncategorized: { expenseMinor: 0, incomeMinor: 0 },
		});
		mockFetch(() => jsonResponse(body));

		const result = await fetchScheduledForecast({ fromDate: '2026-05-01', toDate: '2026-05-30' });

		expect(result.totals).toEqual({ expenseMinor: 1250, incomeMinor: 0, netMinor: -1250 });
		expect(result.byCategory.expense).toEqual({ 'category-1': 1250 });
		expect(calls[0]?.url).toBe(
			'./api/v1/scheduled-transactions/upcoming?limit=200&fromDate=2026-05-01&toDate=2026-05-30'
		);
	});

	test('creates, updates and deletes schedules', async () => {
		mockFetch(() => jsonResponse(schedule(), 201));

		await createScheduledTransaction({
			amountMinor: 1250,
			categoryId: null,
			description: 'Rent',
			endDate: null,
			frequency: 'monthly',
			interval: 1,
			kind: 'expense',
			postingMode: 'automatic',
			startDate: '2026-05-01',
		});
		expect(calls[0]?.method).toBe('POST');
		expect(calls[0]?.url).toBe('./api/v1/scheduled-transactions');
		expect(JSON.parse(calls[0]?.body ?? '{}')).toMatchObject({ amountMinor: 1250, frequency: 'monthly' });

		mockFetch(() => jsonResponse(schedule({ amountMinor: 2000 })));
		await updateScheduledTransaction('schedule-1', { amountMinor: 2000, status: 'paused' });
		expect(calls[0]?.method).toBe('PATCH');
		expect(calls[0]?.url).toBe('./api/v1/scheduled-transactions/schedule-1');

		mockFetch(() => new Response(undefined, { status: 204 }));
		await deleteScheduledTransaction('schedule-1');
		expect(calls[0]?.method).toBe('DELETE');
	});

	test('posts and skips the next occurrence', async () => {
		mockFetch(() => jsonResponse({ scheduledTransaction: schedule({ nextDueDate: '2026-06-01' }) }));

		const posted = await postScheduledTransaction('schedule-1');

		expect(posted.nextDueDate).toBe('2026-06-01');
		expect(calls[0]?.method).toBe('POST');
		expect(calls[0]?.url).toBe('./api/v1/scheduled-transactions/schedule-1/post');

		mockFetch(() => jsonResponse(schedule({ nextDueDate: '2026-06-01' })));
		const skipped = await skipScheduledTransaction('schedule-1');

		expect(skipped.nextDueDate).toBe('2026-06-01');
		expect(calls[0]?.url).toBe('./api/v1/scheduled-transactions/schedule-1/skip');
	});

	test('rejects an invalid page and a non-ok response', async () => {
		mockFetch(() => jsonResponse({ items: [{ ...schedule(), frequency: 'hourly' }], today: '', total: 1 }));

		expect(await outcome(fetchScheduledTransactionPage({}))).toBe('rejected');

		mockFetch(() => new Response(undefined, { status: 500 }));

		expect(await outcome(fetchScheduledForecast())).toBe('rejected');
	});
});
