const TRANSACTION_KIND = {
	EXPENSE: 'expense',
	INCOME: 'income',
} as const;

type TransactionKind = (typeof TRANSACTION_KIND)[keyof typeof TRANSACTION_KIND];

interface Transaction {
	actorId: string;
	amountMinor: number;
	createdAt: string;
	currencyCode: string;
	description: string;
	id: string;
	kind: TransactionKind;
	transactionDate: string;
}

interface TransactionPage {
	items: Transaction[];
	limit: number;
	offset: number;
	total: number;
}

interface TransactionQuery {
	fromDate?: string;
	kind?: TransactionKind;
	limit?: number;
	offset?: number;
	toDate?: string;
}

interface NewTransaction {
	amountMinor: number;
	description: string;
	kind: TransactionKind;
	transactionDate: string;
}

const TRANSACTIONS_URL = './api/v1/transactions';
const MAX_PAGE_SIZE = 100;
const MAX_PAGES = 100;

function isTransactionKind(value: unknown): value is TransactionKind {
	return value === TRANSACTION_KIND.EXPENSE || value === TRANSACTION_KIND.INCOME;
}

function isTransaction(value: unknown): value is Transaction {
	return (
		typeof value === 'object' &&
		value !== null &&
		'id' in value &&
		typeof value.id === 'string' &&
		'kind' in value &&
		isTransactionKind(value.kind) &&
		'amountMinor' in value &&
		typeof value.amountMinor === 'number' &&
		'currencyCode' in value &&
		typeof value.currencyCode === 'string' &&
		'description' in value &&
		typeof value.description === 'string' &&
		'transactionDate' in value &&
		typeof value.transactionDate === 'string'
	);
}

function isTransactionPage(value: unknown): value is TransactionPage {
	return (
		typeof value === 'object' &&
		value !== null &&
		'items' in value &&
		Array.isArray(value.items) &&
		value.items.every((item: unknown) => isTransaction(item)) &&
		'total' in value &&
		typeof value.total === 'number'
	);
}

function queryString(query: TransactionQuery): string {
	const parameters = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value !== undefined) {
			parameters.set(key, String(value));
		}
	}
	const serialized = parameters.toString();

	return serialized ? `?${serialized}` : '';
}

async function fetchTransactionPage(query: TransactionQuery, signal?: AbortSignal): Promise<TransactionPage> {
	const response = await fetch(`${TRANSACTIONS_URL}${queryString(query)}`, {
		headers: { Accept: 'application/json' },
		signal,
	});
	if (!response.ok) {
		throw new Error(`Transaction list request failed with HTTP ${String(response.status)}`);
	}
	const page: unknown = await response.json();
	if (!isTransactionPage(page)) {
		throw new TypeError('Transaction list response was invalid');
	}

	return page;
}

async function fetchAllTransactions(
	query: Omit<TransactionQuery, 'limit' | 'offset'>,
	signal?: AbortSignal
): Promise<Transaction[]> {
	const transactions: Transaction[] = [];
	for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
		// Pages depend on the offset reached so far, so they must be fetched sequentially.
		// eslint-disable-next-line no-await-in-loop
		const page = await fetchTransactionPage(
			{ ...query, limit: MAX_PAGE_SIZE, offset: transactions.length },
			signal
		);
		transactions.push(...page.items);
		if (page.items.length === 0 || transactions.length >= page.total) {
			break;
		}
	}

	return transactions;
}

async function createTransaction(input: NewTransaction): Promise<Transaction> {
	const response = await fetch(TRANSACTIONS_URL, {
		body: JSON.stringify(input),
		headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
		method: 'POST',
	});
	if (!response.ok) {
		throw new Error(`Transaction creation failed with HTTP ${String(response.status)}`);
	}
	const transaction: unknown = await response.json();
	if (!isTransaction(transaction)) {
		throw new TypeError('Transaction response was invalid');
	}

	return transaction;
}

async function deleteTransaction(id: string): Promise<void> {
	const response = await fetch(`${TRANSACTIONS_URL}/${encodeURIComponent(id)}`, {
		headers: { Accept: 'application/json' },
		method: 'DELETE',
	});
	if (!response.ok) {
		throw new Error(`Transaction deletion failed with HTTP ${String(response.status)}`);
	}
}

interface TransactionTotals {
	expenseMinor: number;
	incomeMinor: number;
	netMinor: number;
}

function summarizeTransactions(transactions: readonly Transaction[], currencyCode: string): TransactionTotals {
	let expenseMinor = 0;
	let incomeMinor = 0;
	for (const transaction of transactions) {
		if (transaction.currencyCode !== currencyCode) {
			continue;
		}
		if (transaction.kind === TRANSACTION_KIND.INCOME) {
			incomeMinor += transaction.amountMinor;
		} else {
			expenseMinor += transaction.amountMinor;
		}
	}

	return { expenseMinor, incomeMinor, netMinor: incomeMinor - expenseMinor };
}

export {
	createTransaction,
	deleteTransaction,
	fetchAllTransactions,
	fetchTransactionPage,
	isTransaction,
	isTransactionKind,
	type NewTransaction,
	summarizeTransactions,
	type Transaction,
	TRANSACTION_KIND,
	type TransactionKind,
	type TransactionPage,
	type TransactionQuery,
	type TransactionTotals,
};
