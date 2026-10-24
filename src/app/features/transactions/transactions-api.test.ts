import { afterEach, describe, expect, test } from 'bun:test';

import type { Transaction } from './transactions-api';
import {
	createTransaction,
	deleteTransaction,
	fetchAllTransactions,
	fetchTransactionPage,
	summarizeTransactions,
	updateTransaction,
} from './transactions-api';

interface FetchCall {
	body: string | undefined;
	method: string | undefined;
	url: string;
}

const originalFetch = fetch;
const calls: FetchCall[] = [];

function transaction(overrides: Partial<Transaction> = {}): Transaction {
	return {
		actorId: 'actor',
		amountMinor: 1000,
		createdAt: '2024-03-05T10:00:00.000Z',
		currencyCode: 'EUR',
		description: 'Coffee',
		id: 'transaction-1',
		kind: 'expense',
		transactionDate: '2024-03-05',
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

describe('transactions api', () => {
	test('lists a page using Ingress-relative URLs and query parameters', async () => {
		mockFetch(() => jsonResponse({ items: [transaction()], limit: 20, offset: 40, total: 41 }));

		const page = await fetchTransactionPage({ kind: 'income', limit: 20, offset: 40, search: 'café' });

		expect(page.total).toBe(41);
		expect(calls[0]?.url).toBe('./api/v1/transactions?kind=income&limit=20&offset=40&search=caf%C3%A9');
	});

	test('rejects failed and malformed list responses', async () => {
		mockFetch(() => jsonResponse({ error: 'nope' }, 500));
		expect(await outcome(fetchTransactionPage({}))).toBe('rejected');

		mockFetch(() => jsonResponse({ items: [{ id: 1 }], total: 1 }));
		expect(await outcome(fetchTransactionPage({}))).toBe('rejected');
	});

	test('collects every page of a date range', async () => {
		mockFetch(url => {
			const offset = Number(new URL(url, 'http://localhost').searchParams.get('offset'));
			const items =
				offset === 0 ? [transaction({ id: 'a' }), transaction({ id: 'b' })] : [transaction({ id: 'c' })];

			return jsonResponse({ items, limit: 100, offset, total: 3 });
		});

		const items = await fetchAllTransactions({ fromDate: '2024-03-01', toDate: '2024-03-31' });

		expect(items.map(item => item.id)).toEqual(['a', 'b', 'c']);
		expect(calls).toHaveLength(2);
		expect(calls[1]?.url).toBe('./api/v1/transactions?fromDate=2024-03-01&toDate=2024-03-31&limit=100&offset=2');
	});

	test('creates a transaction with a JSON body', async () => {
		mockFetch(() => jsonResponse(transaction({ id: 'created' }), 201));
		const input = {
			amountMinor: 1000,
			description: 'Coffee',
			kind: 'expense',
			transactionDate: '2024-03-05',
		} as const;

		const created = await createTransaction(input);

		expect(created.id).toBe('created');
		expect(calls[0]?.url).toBe('./api/v1/transactions');
		expect(calls[0]?.method).toBe('POST');
		expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual(input);
	});

	test('rejects when creation fails', async () => {
		mockFetch(() => jsonResponse({ error: 'invalid' }, 400));

		const result = await outcome(
			createTransaction({ amountMinor: 1, description: '', kind: 'income', transactionDate: '2024-03-05' })
		);

		expect(result).toBe('rejected');
	});

	test('updates a transaction with a partial JSON body', async () => {
		mockFetch(() => jsonResponse(transaction({ amountMinor: 2000, description: 'Dinner' })));

		const updated = await updateTransaction('transaction/1', { amountMinor: 2000, description: 'Dinner' });

		expect(updated.amountMinor).toBe(2000);
		expect(calls[0]?.url).toBe('./api/v1/transactions/transaction%2F1');
		expect(calls[0]?.method).toBe('PATCH');
		expect(JSON.parse(calls[0]?.body ?? '{}')).toEqual({ amountMinor: 2000, description: 'Dinner' });
	});

	test('rejects when the update fails', async () => {
		mockFetch(() => jsonResponse({ error: 'not found' }, 404));

		expect(await outcome(updateTransaction('missing', { amountMinor: 100 }))).toBe('rejected');
	});

	test('deletes a transaction by its encoded identifier', async () => {
		mockFetch(() => new Response(undefined, { status: 204 }));

		await deleteTransaction('transaction/1');

		expect(calls[0]?.url).toBe('./api/v1/transactions/transaction%2F1');
		expect(calls[0]?.method).toBe('DELETE');
	});

	test('rejects when deletion fails', async () => {
		mockFetch(() => jsonResponse({ error: 'not found' }, 404));

		expect(await outcome(deleteTransaction('missing'))).toBe('rejected');
	});

	test('summarizes income, expenses and net in the configured currency', () => {
		const totals = summarizeTransactions(
			[
				transaction({ amountMinor: 5000, kind: 'income' }),
				transaction({ amountMinor: 1250, id: 'b' }),
				transaction({ amountMinor: 750, id: 'c' }),
				transaction({ amountMinor: 9999, currencyCode: 'USD', id: 'd' }),
			],
			'EUR'
		);

		expect(totals).toEqual({ expenseMinor: 2000, incomeMinor: 5000, netMinor: 3000 });
	});
});
