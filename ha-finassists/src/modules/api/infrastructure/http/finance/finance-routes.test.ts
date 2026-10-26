import { handleMcpRequest, MCP_MAX_BODY_BYTES } from '@modules/api/infrastructure/http/mcp/mcp-transport';
import { handleRequest } from '@modules/api/infrastructure/http/routes';
import { createHttpContainer } from '@modules/api/infrastructure/http/shared/http-container';
import {
	CreateCategory,
	CreateScheduledTransaction,
	CreateTransaction,
	DeleteCategory,
	DeleteScheduledTransaction,
	DeleteTransaction,
	DeleteTransactions,
	ListCategories,
	ListScheduledTransactions,
	ListTransactions,
	ListUpcomingScheduledTransactions,
	PostScheduledTransaction,
	SkipScheduledTransaction,
	UpdateCategory,
	UpdateScheduledTransaction,
	UpdateTransaction,
} from '@modules/ledger/application';
import {
	SqliteCategoryRepository,
	SqliteLedgerRepository,
	SqliteScheduledTransactionRepository,
} from '@modules/ledger/infrastructure';
import { migrateDatabase } from '@modules/storage/infrastructure';
import { AuthenticateApiToken, IssueApiToken, ListApiTokens, RevokeApiToken } from '@modules/tokens/application';
import { SqliteApiTokenRepository, WebCryptoTokenCredentialService } from '@modules/tokens/infrastructure';
import { Database } from 'bun:sqlite';
import { afterEach, describe, expect, it } from 'bun:test';

import type { FinanceUseCases } from './finance-routes';
import { handleFinanceRequest } from './finance-routes';

const databases: Database[] = [];

interface CategoryJson {
	createdAt: string;
	id: string;
	kind: string;
	name: string;
	scheduledTransactionCount?: number;
	transactionCount?: number;
}
interface ScheduledTransactionJson {
	amountMinor: number;
	categoryId: null | string;
	createdAt: string;
	createdBy: null | string;
	currencyCode: string;
	description: string;
	endDate: null | string;
	frequency: string;
	id: string;
	interval: number;
	kind: string;
	nextDueDate: null | string;
	postingMode: string;
	startDate: string;
	status: string;
}
interface ScheduledUpcomingJson {
	byCategory: {
		expense: Record<string, number>;
		income: Record<string, number>;
	};
	currencyCode: string;
	fromDate: string;
	items: { dueDate: string; kind: string; scheduleId: string }[];
	toDate: string;
	today: string;
	total: number;
	totals: { expenseMinor: number; incomeMinor: number; netMinor: number };
	uncategorized: { expenseMinor: number; incomeMinor: number };
}
interface TransactionJson {
	actorId: null | string;
	amountMinor: number;
	categoryId: null | string;
	currencyCode: string;
	description: string;
	id: string;
	kind: string;
	transactionDate: string;
}
interface PaginatedJson<T> {
	items: T[];
	limit: number;
	offset: number;
	total: number;
}
interface MCPJson {
	error: { code: number };
	result: {
		isError: boolean;
		serverInfo: { name: string };
		structuredContent: TransactionJson & { items: TransactionJson[]; total: number };
		tools: { name: string }[];
	};
}
interface MCPScheduledJson {
	result: {
		isError: boolean;
		structuredContent: {
			id: string;
			items: { id: string; nextDueDate: null | string }[];
			nextDueDate: null | string;
			scheduledTransaction: { nextDueDate: null | string; status: string };
			total: number;
			totals: { expenseMinor: number; incomeMinor: number; netMinor: number };
			transaction: { transactionDate: string };
		};
	};
}

function createMigratedDatabase(): Database {
	const database = new Database(':memory:');
	databases.push(database);
	migrateDatabase(database);

	return database;
}

function setup(): { useCases: FinanceUseCases } {
	const database = createMigratedDatabase();
	const repository = new SqliteLedgerRepository(database);
	const categoryRepository = new SqliteCategoryRepository(database);
	const scheduledRepository = new SqliteScheduledTransactionRepository(database);

	return {
		useCases: {
			ledger: {
				categories: {
					create: new CreateCategory(categoryRepository),
					delete: new DeleteCategory(categoryRepository),
					list: new ListCategories(categoryRepository),
					update: new UpdateCategory(categoryRepository),
				},
				create: new CreateTransaction(repository, categoryRepository, 'EUR'),
				delete: new DeleteTransaction(repository),
				deleteMany: new DeleteTransactions(repository),
				list: new ListTransactions(repository),
				scheduled: {
					create: new CreateScheduledTransaction(scheduledRepository, categoryRepository, 'EUR'),
					delete: new DeleteScheduledTransaction(scheduledRepository),
					list: new ListScheduledTransactions(scheduledRepository),
					post: new PostScheduledTransaction(scheduledRepository),
					skip: new SkipScheduledTransaction(scheduledRepository),
					upcoming: new ListUpcomingScheduledTransactions(scheduledRepository, 'EUR'),
					update: new UpdateScheduledTransaction(scheduledRepository, categoryRepository),
				},
				update: new UpdateTransaction(repository, categoryRepository),
			},
			today: () => '2026-05-15',
		},
	};
}

function setupTokens() {
	const repository = new SqliteApiTokenRepository(createMigratedDatabase());
	const credentialService = new WebCryptoTokenCredentialService();

	return {
		authenticate: new AuthenticateApiToken(repository, credentialService),
		issue: new IssueApiToken(repository, credentialService),
		list: new ListApiTokens(repository),
		revoke: new RevokeApiToken(repository),
	};
}

async function readJson<T>(response: Response): Promise<T> {
	return JSON.parse(await response.text()) as T;
}

async function send(useCases: FinanceUseCases, pathname: string, method = 'GET', body?: unknown): Promise<Response> {
	return handleFinanceRequest(
		new Request(`http://localhost${pathname}`, {
			method,
			...(body !== undefined && { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
		}),
		{ id: 'actor-123', kind: 'home_assistant_user' },
		useCases
	);
}

async function sendJson<T>(useCases: FinanceUseCases, pathname: string, method?: string, body?: unknown): Promise<T> {
	return readJson<T>(await send(useCases, pathname, method, body));
}

async function statusOf(useCases: FinanceUseCases, pathname: string, method?: string): Promise<number> {
	const response = await send(useCases, pathname, method);

	return response.status;
}

afterEach(() => {
	for (const database of databases) {
		database.close();
	}
	databases.length = 0;
});

describe('transactions REST routes', () => {
	it('records expenses and incomes with actor attribution', async () => {
		const { useCases } = setup();
		const expense = await send(useCases, '/api/v1/transactions', 'POST', {
			amountMinor: 1250,
			description: '  Groceries ',
			kind: 'expense',
			transactionDate: '2026-05-10',
		});
		const income = await send(useCases, '/api/v1/transactions', 'POST', {
			amountMinor: 200_000,
			kind: 'income',
			transactionDate: '2026-05-01',
		});
		const expenseBody = await readJson<TransactionJson>(expense);
		const incomeBody = await readJson<TransactionJson>(income);

		expect(expense.status).toBe(201);
		expect(expenseBody).toMatchObject({
			actorId: 'actor-123',
			amountMinor: 1250,
			currencyCode: 'EUR',
			description: 'Groceries',
			kind: 'expense',
			transactionDate: '2026-05-10',
		});
		expect(expenseBody.id).toBeTruthy();
		expect(income.status).toBe(201);
		expect(incomeBody).toMatchObject({ description: '', kind: 'income' });
	});

	it('lists newest first with filters and pagination', async () => {
		const { useCases } = setup();
		const entries = [
			['expense', '2026-05-10'],
			['income', '2026-05-01'],
			['expense', '2026-04-20'],
		] as const;
		await Promise.all(
			entries.map(async ([kind, transactionDate]) =>
				send(useCases, '/api/v1/transactions', 'POST', { amountMinor: 100, kind, transactionDate })
			)
		);

		const all = await sendJson<PaginatedJson<TransactionJson>>(useCases, '/api/v1/transactions');
		const expenses = await sendJson<PaginatedJson<TransactionJson>>(useCases, '/api/v1/transactions?kind=expense');
		const may = await sendJson<PaginatedJson<TransactionJson>>(
			useCases,
			'/api/v1/transactions?fromDate=2026-05-01&toDate=2026-05-31'
		);
		const page = await sendJson<PaginatedJson<TransactionJson>>(useCases, '/api/v1/transactions?limit=1&offset=1');

		expect(all.items.map(item => item.transactionDate)).toEqual(['2026-05-10', '2026-05-01', '2026-04-20']);
		expect(all).toMatchObject({ limit: 100, offset: 0, total: 3 });
		expect(expenses.total).toBe(2);
		expect(may.total).toBe(2);
		expect(page).toMatchObject({ limit: 1, offset: 1, total: 3 });
		expect(page.items.map(item => item.transactionDate)).toEqual(['2026-05-01']);
	});

	it('searches transaction descriptions', async () => {
		const { useCases } = setup();
		await send(useCases, '/api/v1/transactions', 'POST', {
			amountMinor: 100,
			description: 'Supermercado Mercadona',
			kind: 'expense',
			transactionDate: '2026-05-10',
		});
		await send(useCases, '/api/v1/transactions', 'POST', {
			amountMinor: 200,
			description: 'Café con amigos',
			kind: 'expense',
			transactionDate: '2026-05-11',
		});

		const matching = await sendJson<PaginatedJson<TransactionJson>>(
			useCases,
			'/api/v1/transactions?search=mercadona'
		);
		const missing = await sendJson<PaginatedJson<TransactionJson>>(
			useCases,
			'/api/v1/transactions?search=gimnasio'
		);

		expect(matching.items.map(item => item.description)).toEqual(['Supermercado Mercadona']);
		expect(missing.total).toBe(0);
	});

	it('rejects invalid input without leaking internals', async () => {
		const { useCases } = setup();
		const valid = { amountMinor: 100, kind: 'expense', transactionDate: '2026-05-10' };
		const invalidBodies = [
			{ ...valid, amountMinor: 0 },
			{ ...valid, amountMinor: 1.5 },
			{ ...valid, kind: 'transfer' },
			{ ...valid, transactionDate: '2026-02-30' },
			{ ...valid, transactionDate: '10/05/2026' },
			{ ...valid, description: 'x'.repeat(201) },
		];
		const responses = await Promise.all(
			invalidBodies.map(async body => send(useCases, '/api/v1/transactions', 'POST', body))
		);
		const payloads = await Promise.all(responses.map(async response => response.text()));
		expect(responses.map(response => response.status)).toEqual(invalidBodies.map(() => 400));
		expect(payloads.join('')).not.toContain('SQLITE');
		const malformed = await handleFinanceRequest(
			new Request('http://localhost/api/v1/transactions', { body: '{', method: 'POST' }),
			{ id: 'actor-123' },
			useCases
		);
		expect(malformed.status).toBe(400);
		const queries = ['kind=other', 'limit=0', 'limit=101', 'offset=-1', 'fromDate=yesterday'];
		const statuses = await Promise.all(
			queries.map(async query => statusOf(useCases, `/api/v1/transactions?${query}`))
		);
		expect(statuses).toEqual(queries.map(() => 400));
	});

	it('returns 404 for removed routes and 405 for unsupported methods', async () => {
		const { useCases } = setup();

		expect(await statusOf(useCases, '/api/v1/books')).toBe(404);
		expect(await statusOf(useCases, '/api/v1/accounts')).toBe(404);
		const deleted = await send(useCases, '/api/v1/transactions', 'PUT');
		expect(deleted.status).toBe(405);
		expect(deleted.headers.get('allow')).toBe('GET, POST, DELETE');
		const patched = await send(useCases, '/api/v1/transactions/transaction-1', 'PATCH');
		expect(patched.status).toBe(400);
		const put = await send(useCases, '/api/v1/transactions/transaction-1', 'PUT');
		expect(put.status).toBe(405);
		expect(put.headers.get('allow')).toBe('DELETE, PATCH');
	});

	it('updates a transaction and reports a missing one', async () => {
		const { useCases } = setup();
		const created = await sendJson<TransactionJson>(useCases, '/api/v1/transactions', 'POST', {
			amountMinor: 1250,
			description: 'Lunch',
			kind: 'expense',
			transactionDate: '2026-05-10',
		});

		const response = await send(useCases, `/api/v1/transactions/${created.id}`, 'PATCH', {
			amountMinor: 2500,
			description: 'Dinner',
			kind: 'income',
			transactionDate: '2026-05-11',
		});
		const updated = await readJson<TransactionJson>(response);
		const missing = await send(useCases, '/api/v1/transactions/missing', 'PATCH', { amountMinor: 100 });

		expect(response.status).toBe(200);
		expect(updated).toMatchObject({
			amountMinor: 2500,
			description: 'Dinner',
			id: created.id,
			kind: 'income',
			transactionDate: '2026-05-11',
		});
		expect(missing.status).toBe(404);
	});

	it('deletes a transaction and reports a missing one', async () => {
		const { useCases } = setup();
		const created = await sendJson<TransactionJson>(useCases, '/api/v1/transactions', 'POST', {
			amountMinor: 1250,
			kind: 'expense',
			transactionDate: '2026-05-10',
		});

		const deleted = await send(useCases, `/api/v1/transactions/${created.id}`, 'DELETE');
		const remaining = await sendJson<PaginatedJson<TransactionJson>>(useCases, '/api/v1/transactions');
		const missing = await send(useCases, `/api/v1/transactions/${created.id}`, 'DELETE');
		const missingBody = await readJson<{ error: string }>(missing);

		expect(deleted.status).toBe(204);
		expect(remaining.total).toBe(0);
		expect(missing.status).toBe(404);
		expect(missingBody.error).toContain('not found');
	});

	it('deletes several transactions in one request', async () => {
		const { useCases } = setup();
		const created = await Promise.all(
			['a', 'b', 'c'].map(async description =>
				sendJson<TransactionJson>(useCases, '/api/v1/transactions', 'POST', {
					amountMinor: 100,
					description,
					kind: 'expense',
					transactionDate: '2026-05-10',
				})
			)
		);

		const deleted = await send(useCases, '/api/v1/transactions', 'DELETE', {
			ids: created.slice(0, 2).map(item => item.id),
		});
		const remaining = await sendJson<PaginatedJson<TransactionJson>>(useCases, '/api/v1/transactions');
		const invalid = await send(useCases, '/api/v1/transactions', 'DELETE', { ids: [] });

		expect(deleted.status).toBe(204);
		expect(remaining.items.map(item => item.description)).toEqual(['c']);
		expect(invalid.status).toBe(400);
	});

	it('serves stateless MCP tools only with a valid bearer token', async () => {
		const { useCases } = setup();
		const tokenUseCases = setupTokens();
		const httpContext = { remoteAddress: '[IP_ADDRESS]', trustedIngressIp: '[IP_ADDRESS]' };
		const mcpRequest = (headers: Record<string, string> = {}) =>
			new Request('http://localhost/mcp', {
				body: JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'tools/list' }),
				headers: {
					Accept: 'application/json, text/event-stream',
					'Content-Type': 'application/json',
					...headers,
				},
				method: 'POST',
			});
		const container = createHttpContainer({ financeUseCases: useCases, tokenUseCases });
		const unauthorized = await handleRequest(mcpRequest(), httpContext, container);
		expect(unauthorized.status).toBe(401);

		const issued = await tokenUseCases.issue.execute({ name: 'MCP client', ownerId: 'mcp-owner' });
		const authorization = `Bearer ${issued.secret}`;
		const viaApp = await handleRequest(mcpRequest({ Authorization: authorization }), httpContext, container);
		expect(viaApp.status).toBe(200);
		expect(viaApp.headers.get('content-security-policy')).toContain('default-src');
		const rest = await handleRequest(
			new Request('http://localhost/api/v1/transactions', { headers: { Authorization: authorization } }),
			{ remoteAddress: '[IP_ADDRESS]', trustedIngressIp: '::1' },
			container
		);
		expect(rest.status).toBe(200);
		const restBody = await readJson<PaginatedJson<unknown>>(rest);
		expect(restBody.total).toBe(0);

		const call = async (message: unknown, extraHeaders: Record<string, string> = {}) =>
			handleMcpRequest(
				new Request('http://localhost/mcp', {
					body: JSON.stringify(message),
					headers: {
						Accept: 'application/json, text/event-stream',
						Authorization: authorization,
						'Content-Type': 'application/json',
						...extraHeaders,
					},
					method: 'POST',
				}),
				tokenUseCases,
				useCases
			);
		const initialized = await call({
			id: 1,
			jsonrpc: '2.0',
			method: 'initialize',
			params: { protocolVersion: '2025-11-25' },
		});
		const listResponse = await call({ id: 2, jsonrpc: '2.0', method: 'tools/list' });
		const listed = await readJson<MCPJson>(listResponse);
		const created = await readJson<MCPJson>(
			await call({
				id: 3,
				jsonrpc: '2.0',
				method: 'tools/call',
				params: {
					arguments: {
						amountMinor: 450,
						description: 'Coffee',
						kind: 'expense',
						transactionDate: '2026-05-10',
					},
					name: 'create_transaction',
				},
			})
		);
		const invalid = await readJson<MCPJson>(
			await call({
				id: 4,
				jsonrpc: '2.0',
				method: 'tools/call',
				params: {
					arguments: { amountMinor: -1, kind: 'expense', transactionDate: '2026-05-10' },
					name: 'create_transaction',
				},
			})
		);
		const mcpList = await readJson<MCPJson>(
			await call({
				id: 5,
				jsonrpc: '2.0',
				method: 'tools/call',
				params: { arguments: { kind: 'expense', limit: 10 }, name: 'list_transactions' },
			})
		);
		const deleted = await readJson<MCPJson>(
			await call({
				id: 6,
				jsonrpc: '2.0',
				method: 'tools/call',
				params: { arguments: { id: created.result.structuredContent.id }, name: 'delete_transaction' },
			})
		);
		const removed = await readJson<MCPJson>(
			await call({ id: 7, jsonrpc: '2.0', method: 'tools/call', params: { arguments: {}, name: 'list_books' } })
		);
		const notification = await call({ jsonrpc: '2.0', method: 'notifications/initialized' });
		const invalidOrigin = await call(
			{ id: 8, jsonrpc: '2.0', method: 'ping' },
			{ Origin: 'https://untrusted.example' }
		);
		const unacceptable = await call({ id: 9, jsonrpc: '2.0', method: 'ping' }, { Accept: 'application/json' });
		const responseToGet = await handleMcpRequest(new Request('http://localhost/mcp'), tokenUseCases, useCases);

		const initializedBody = await readJson<MCPJson>(initialized);
		expect(initializedBody.result.serverInfo.name).toBe('fin-assist');
		expect(initialized.headers.get('mcp-session-id')).toBeNull();
		expect(listed.result.tools.map(tool => tool.name)).toEqual([
			'create_category',
			'create_scheduled_transaction',
			'create_transaction',
			'delete_category',
			'delete_scheduled_transaction',
			'delete_transaction',
			'list_categories',
			'list_scheduled_transactions',
			'list_transactions',
			'list_upcoming_scheduled_transactions',
			'post_scheduled_transaction',
			'skip_scheduled_transaction',
			'update_scheduled_transaction',
		]);
		expect(created.result.isError).toBe(false);
		expect(created.result.structuredContent).toMatchObject({
			actorId: 'mcp-owner',
			amountMinor: 450,
			kind: 'expense',
		});
		expect(invalid.result.isError).toBe(true);
		expect(mcpList.result.structuredContent.total).toBe(1);
		expect(deleted.result.isError).toBe(false);
		expect(removed.error.code).toBe(-32_602);
		expect(notification.status).toBe(202);
		expect(invalidOrigin.status).toBe(403);
		expect(unacceptable.status).toBe(406);
		expect(responseToGet.status).toBe(405);

		await tokenUseCases.revoke.execute({ id: issued.token.id, ownerId: 'mcp-owner' });
		const noAuth = await call({ id: 10, jsonrpc: '2.0', method: 'tools/list' });
		expect(noAuth.status).toBe(401);
	});

	it('validates MCP protocol version, malformed JSON and body size', async () => {
		const { useCases } = setup();
		const tokenUseCases = setupTokens();
		const issued = await tokenUseCases.issue.execute({ name: 'Client', ownerId: 'token-owner' });
		const post = (body: string, headers: Record<string, string> = {}) =>
			handleMcpRequest(
				new Request('http://localhost/mcp', {
					body,
					headers: {
						Accept: 'application/json, text/event-stream',
						Authorization: `Bearer ${issued.secret}`,
						'Content-Type': 'application/json',
						...headers,
					},
					method: 'POST',
				}),
				tokenUseCases,
				useCases
			);

		const unsupported = await post(JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'tools/list' }), {
			'MCP-Protocol-Version': 'unsupported-version',
		});
		const malformed = await post('{');
		const tooLarge = await post(' '.repeat(MCP_MAX_BODY_BYTES + 1));

		const unsupportedBody = await readJson<MCPJson>(unsupported);
		expect(unsupportedBody.error.code).toBe(-32_600);
		expect(malformed.status).toBe(200);
		const malformedBody = await readJson<MCPJson>(malformed);
		expect(malformedBody.error.code).toBe(-32_700);
		expect(tooLarge.status).toBe(413);
	});
});

describe('categories REST routes', () => {
	it('creates, lists and filters categories with their usage', async () => {
		const { useCases } = setup();
		const created = await send(useCases, '/api/v1/categories', 'POST', { kind: 'expense', name: '  Food ' });
		const income = await send(useCases, '/api/v1/categories', 'POST', { kind: 'income', name: 'Salary' });
		const createdBody = await readJson<CategoryJson>(created);
		const list = await sendJson<{ items: CategoryJson[] }>(useCases, '/api/v1/categories');
		const expenses = await sendJson<{ items: CategoryJson[] }>(useCases, '/api/v1/categories?kind=expense');

		expect(created.status).toBe(201);
		expect(createdBody).toMatchObject({ kind: 'expense', name: 'Food' });
		expect(income.status).toBe(201);
		expect(list.items).toHaveLength(2);
		expect(list.items.every(item => item.transactionCount === 0)).toBe(true);
		expect(expenses.items.map(item => item.name)).toEqual(['Food']);
	});

	it('reports the usage of a category and refuses to delete it', async () => {
		const { useCases } = setup();
		const category = await sendJson<CategoryJson>(useCases, '/api/v1/categories', 'POST', {
			kind: 'expense',
			name: 'Food',
		});
		await send(useCases, '/api/v1/transactions', 'POST', {
			amountMinor: 500,
			categoryId: category.id,
			kind: 'expense',
			transactionDate: '2026-05-10',
		});

		const list = await sendJson<{ items: CategoryJson[] }>(useCases, '/api/v1/categories');
		const deleted = await send(useCases, `/api/v1/categories/${category.id}`, 'DELETE');
		const body = await readJson<{ error: string }>(deleted);

		expect(list.items[0]?.transactionCount).toBe(1);
		expect(deleted.status).toBe(409);
		expect(body.error).toContain('cannot');
	});

	it('renames a category and rejects duplicates within a kind', async () => {
		const { useCases } = setup();
		const first = await sendJson<CategoryJson>(useCases, '/api/v1/categories', 'POST', {
			kind: 'expense',
			name: 'Food',
		});
		await send(useCases, '/api/v1/categories', 'POST', { kind: 'expense', name: 'Travel' });

		const renamed = await send(useCases, `/api/v1/categories/${first.id}`, 'PATCH', { name: 'Groceries' });
		const duplicate = await send(useCases, `/api/v1/categories/${first.id}`, 'PATCH', { name: 'travel' });
		const renamedBody = await readJson<CategoryJson>(renamed);

		expect(renamedBody.name).toBe('Groceries');
		expect(duplicate.status).toBe(409);
	});

	it('deletes an unused category and reports missing ones', async () => {
		const { useCases } = setup();
		const category = await sendJson<CategoryJson>(useCases, '/api/v1/categories', 'POST', {
			kind: 'income',
			name: 'Salary',
		});

		const deleted = await send(useCases, `/api/v1/categories/${category.id}`, 'DELETE');
		const missing = await send(useCases, '/api/v1/categories/missing', 'DELETE');
		const unsupported = await send(useCases, '/api/v1/categories', 'PUT');

		expect(deleted.status).toBe(204);
		expect(missing.status).toBe(404);
		expect(unsupported.status).toBe(405);
	});

	it('rejects an invalid category without leaking internals', async () => {
		const { useCases } = setup();
		const invalidKind = await send(useCases, '/api/v1/categories', 'POST', { kind: 'transfer', name: 'Food' });
		const emptyName = await send(useCases, '/api/v1/categories', 'POST', { kind: 'expense', name: '  ' });

		expect(invalidKind.status).toBe(400);
		expect(emptyName.status).toBe(400);
	});
});

describe('category assignments in transactions', () => {
	it('assigns, filters and clears a category', async () => {
		const { useCases } = setup();
		const category = await sendJson<CategoryJson>(useCases, '/api/v1/categories', 'POST', {
			kind: 'expense',
			name: 'Food',
		});
		const other = await sendJson<CategoryJson>(useCases, '/api/v1/categories', 'POST', {
			kind: 'expense',
			name: 'Travel',
		});
		const categorized = await sendJson<TransactionJson>(useCases, '/api/v1/transactions', 'POST', {
			amountMinor: 500,
			categoryId: category.id,
			kind: 'expense',
			transactionDate: '2026-05-10',
		});
		await send(useCases, '/api/v1/transactions', 'POST', {
			amountMinor: 900,
			categoryId: other.id,
			kind: 'expense',
			transactionDate: '2026-05-11',
		});

		const filtered = await sendJson<PaginatedJson<TransactionJson>>(
			useCases,
			`/api/v1/transactions?categoryId=${category.id}`
		);
		const cleared = await sendJson<TransactionJson>(useCases, `/api/v1/transactions/${categorized.id}`, 'PATCH', {
			categoryId: null,
		});

		expect(categorized.categoryId).toBe(category.id);
		expect(filtered.total).toBe(1);
		expect(cleared.categoryId).toBeNull();
	});

	it('rejects a category of another kind', async () => {
		const { useCases } = setup();
		const category = await sendJson<CategoryJson>(useCases, '/api/v1/categories', 'POST', {
			kind: 'income',
			name: 'Salary',
		});

		const rejected = await send(useCases, '/api/v1/transactions', 'POST', {
			amountMinor: 500,
			categoryId: category.id,
			kind: 'expense',
			transactionDate: '2026-05-10',
		});

		expect(rejected.status).toBe(400);
	});
});

describe('categories over MCP', () => {
	it('creates a category and records a transaction with it', async () => {
		const { useCases } = setup();
		const tokenUseCases = setupTokens();
		const issued = await tokenUseCases.issue.execute({ name: 'Client', ownerId: 'mcp-owner' });
		const call = async (message: unknown) =>
			handleMcpRequest(
				new Request('http://localhost/mcp', {
					body: JSON.stringify(message),
					headers: {
						Accept: 'application/json, text/event-stream',
						Authorization: `Bearer ${issued.secret}`,
						'Content-Type': 'application/json',
					},
					method: 'POST',
				}),
				tokenUseCases,
				useCases
			);
		const category = await readJson<MCPJson>(
			await call({
				id: 1,
				jsonrpc: '2.0',
				method: 'tools/call',
				params: { arguments: { kind: 'expense', name: 'Food' }, name: 'create_category' },
			})
		);
		const listed = await readJson<MCPJson>(
			await call({
				id: 2,
				jsonrpc: '2.0',
				method: 'tools/call',
				params: { arguments: { kind: 'expense' }, name: 'list_categories' },
			})
		);
		const transaction = await readJson<MCPJson>(
			await call({
				id: 3,
				jsonrpc: '2.0',
				method: 'tools/call',
				params: {
					arguments: {
						amountMinor: 500,
						categoryId: category.result.structuredContent.id,
						kind: 'expense',
						transactionDate: '2026-05-10',
					},
					name: 'create_transaction',
				},
			})
		);
		const removed = await readJson<MCPJson>(
			await call({
				id: 4,
				jsonrpc: '2.0',
				method: 'tools/call',
				params: { arguments: { id: category.result.structuredContent.id }, name: 'delete_category' },
			})
		);

		expect(category.result.isError).toBe(false);
		expect(listed.result.structuredContent.items).toHaveLength(1);
		expect(transaction.result.structuredContent.categoryId).toBe(category.result.structuredContent.id);
		expect(removed.result.isError).toBe(true);
	});
});

describe('scheduled transactions REST routes', () => {
	it('creates, lists, updates and deletes a schedule', async () => {
		const { useCases } = setup();
		const created = await send(useCases, '/api/v1/scheduled-transactions', 'POST', {
			amountMinor: 1250,
			description: 'Rent',
			frequency: 'monthly',
			kind: 'expense',
			startDate: '2026-05-01',
		});
		const body = await readJson<ScheduledTransactionJson>(created);
		const list = await sendJson<PaginatedJson<ScheduledTransactionJson> & { today: string }>(
			useCases,
			'/api/v1/scheduled-transactions'
		);
		const updated = await sendJson<ScheduledTransactionJson>(
			useCases,
			`/api/v1/scheduled-transactions/${body.id}`,
			'PATCH',
			{ amountMinor: 2000 }
		);
		const deleted = await send(useCases, `/api/v1/scheduled-transactions/${body.id}`, 'DELETE');
		const empty = await sendJson<PaginatedJson<ScheduledTransactionJson>>(
			useCases,
			'/api/v1/scheduled-transactions'
		);

		expect(created.status).toBe(201);
		expect(body).toMatchObject({
			amountMinor: 1250,
			createdBy: 'actor-123',
			currencyCode: 'EUR',
			description: 'Rent',
			frequency: 'monthly',
			interval: 1,
			kind: 'expense',
			nextDueDate: '2026-05-01',
			postingMode: 'automatic',
			startDate: '2026-05-01',
			status: 'active',
		});
		expect(list).toMatchObject({ limit: 100, offset: 0, today: '2026-05-15', total: 1 });
		expect(updated.amountMinor).toBe(2000);
		expect(deleted.status).toBe(204);
		expect(empty.total).toBe(0);
	});

	it('posts a due manual occurrence and skips another', async () => {
		const { useCases } = setup();
		const first = await sendJson<ScheduledTransactionJson>(useCases, '/api/v1/scheduled-transactions', 'POST', {
			amountMinor: 1000,
			frequency: 'monthly',
			kind: 'expense',
			postingMode: 'manual',
			startDate: '2026-05-01',
		});
		const second = await sendJson<ScheduledTransactionJson>(useCases, '/api/v1/scheduled-transactions', 'POST', {
			amountMinor: 500,
			frequency: 'monthly',
			kind: 'income',
			postingMode: 'manual',
			startDate: '2026-05-01',
		});
		const posted = await sendJson<{
			scheduledTransaction: ScheduledTransactionJson;
			transaction: TransactionJson;
		}>(useCases, `/api/v1/scheduled-transactions/${first.id}/post`, 'POST');
		const skipped = await sendJson<ScheduledTransactionJson>(
			useCases,
			`/api/v1/scheduled-transactions/${second.id}/skip`,
			'POST'
		);
		const transactions = await sendJson<PaginatedJson<TransactionJson>>(useCases, '/api/v1/transactions');

		expect(posted.transaction).toMatchObject({
			actorId: 'actor-123',
			amountMinor: 1000,
			kind: 'expense',
			transactionDate: '2026-05-01',
		});
		expect(posted.scheduledTransaction.nextDueDate).toBe('2026-06-01');
		expect(skipped.nextDueDate).toBe('2026-06-01');
		expect(transactions.total).toBe(1);
	});

	it('returns the upcoming forecast and filters by kind', async () => {
		const { useCases } = setup();
		const category = await sendJson<CategoryJson>(useCases, '/api/v1/categories', 'POST', {
			kind: 'expense',
			name: 'Food',
		});
		await send(useCases, '/api/v1/scheduled-transactions', 'POST', {
			amountMinor: 1000,
			categoryId: category.id,
			frequency: 'monthly',
			kind: 'expense',
			startDate: '2026-05-01',
		});
		await send(useCases, '/api/v1/scheduled-transactions', 'POST', {
			amountMinor: 2000,
			frequency: 'once',
			kind: 'income',
			startDate: '2026-05-15',
		});

		const forecast = await sendJson<ScheduledUpcomingJson>(
			useCases,
			'/api/v1/scheduled-transactions/upcoming?fromDate=2026-05-01&toDate=2026-07-01'
		);
		const income = await sendJson<ScheduledUpcomingJson>(
			useCases,
			'/api/v1/scheduled-transactions/upcoming?fromDate=2026-05-01&toDate=2026-07-01&kind=income'
		);

		expect(forecast).toMatchObject({
			currencyCode: 'EUR',
			fromDate: '2026-05-01',
			toDate: '2026-07-01',
			today: '2026-05-15',
			total: 4,
			totals: { expenseMinor: 3000, incomeMinor: 2000, netMinor: -1000 },
			uncategorized: { expenseMinor: 0, incomeMinor: 2000 },
		});
		expect(forecast.byCategory.expense).toEqual({ [category.id]: 3000 });
		expect(forecast.items.map(item => item.dueDate)).toEqual([
			'2026-05-01',
			'2026-05-15',
			'2026-06-01',
			'2026-07-01',
		]);
		expect(income.total).toBe(1);
		expect(income.items[0]?.kind).toBe('income');
	});

	it('validates scheduled transaction requests', async () => {
		const { useCases } = setup();
		const badFrequency = await send(useCases, '/api/v1/scheduled-transactions', 'POST', {
			amountMinor: 100,
			frequency: 'hourly',
			kind: 'expense',
			startDate: '2026-05-01',
		});
		const badInterval = await send(useCases, '/api/v1/scheduled-transactions', 'POST', {
			amountMinor: 100,
			frequency: 'daily',
			interval: 0,
			kind: 'expense',
			startDate: '2026-05-01',
		});
		const badDate = await send(useCases, '/api/v1/scheduled-transactions', 'POST', {
			amountMinor: 100,
			frequency: 'monthly',
			kind: 'expense',
			startDate: '2026-02-30',
		});
		const future = await sendJson<ScheduledTransactionJson>(useCases, '/api/v1/scheduled-transactions', 'POST', {
			amountMinor: 100,
			frequency: 'once',
			kind: 'expense',
			startDate: '2026-06-01',
		});
		const notDue = await send(useCases, `/api/v1/scheduled-transactions/${future.id}/post`, 'POST');
		const missing = await send(useCases, '/api/v1/scheduled-transactions/missing/post', 'POST');
		const unsupported = await send(useCases, '/api/v1/scheduled-transactions', 'PUT');

		expect(badFrequency.status).toBe(400);
		expect(badInterval.status).toBe(400);
		expect(badDate.status).toBe(400);
		expect(notDue.status).toBe(409);
		expect(missing.status).toBe(404);
		expect(unsupported.status).toBe(405);
	});

	it('reports scheduled usage in the category summary', async () => {
		const { useCases } = setup();
		const category = await sendJson<CategoryJson>(useCases, '/api/v1/categories', 'POST', {
			kind: 'expense',
			name: 'Food',
		});
		await send(useCases, '/api/v1/scheduled-transactions', 'POST', {
			amountMinor: 1000,
			categoryId: category.id,
			frequency: 'monthly',
			kind: 'expense',
			startDate: '2026-05-01',
		});

		const list = await sendJson<{ items: CategoryJson[] }>(useCases, '/api/v1/categories');
		const deleted = await send(useCases, `/api/v1/categories/${category.id}`, 'DELETE');

		expect(list.items[0]).toMatchObject({ scheduledTransactionCount: 1, transactionCount: 0 });
		expect(deleted.status).toBe(409);
	});

	it('filters the scheduled list', async () => {
		const { useCases } = setup();
		await send(useCases, '/api/v1/scheduled-transactions', 'POST', {
			amountMinor: 1000,
			frequency: 'monthly',
			kind: 'expense',
			startDate: '2026-05-01',
		});
		await send(useCases, '/api/v1/scheduled-transactions', 'POST', {
			amountMinor: 2000,
			frequency: 'monthly',
			kind: 'income',
			postingMode: 'manual',
			startDate: '2026-06-01',
		});

		const manualIncome = await sendJson<PaginatedJson<ScheduledTransactionJson>>(
			useCases,
			'/api/v1/scheduled-transactions?kind=income&postingMode=manual&status=active'
		);
		const due = await sendJson<PaginatedJson<ScheduledTransactionJson>>(
			useCases,
			'/api/v1/scheduled-transactions?dueThrough=2026-05-31'
		);

		expect(manualIncome.total).toBe(1);
		expect(manualIncome.items[0]?.kind).toBe('income');
		expect(due.total).toBe(1);
	});
});

describe('scheduled transactions over MCP', () => {
	it('creates, lists, forecasts, posts, skips, pauses and deletes schedules', async () => {
		const { useCases } = setup();
		const tokenUseCases = setupTokens();
		const issued = await tokenUseCases.issue.execute({ name: 'Client', ownerId: 'mcp-owner' });
		const call = async (message: unknown) =>
			handleMcpRequest(
				new Request('http://localhost/mcp', {
					body: JSON.stringify(message),
					headers: {
						Accept: 'application/json, text/event-stream',
						Authorization: `Bearer ${issued.secret}`,
						'Content-Type': 'application/json',
					},
					method: 'POST',
				}),
				tokenUseCases,
				useCases
			);
		const create = async (id: number) => {
			return readJson<MCPScheduledJson>(
				await call({
					id,
					jsonrpc: '2.0',
					method: 'tools/call',
					params: {
						arguments: {
							amountMinor: 1000,
							frequency: 'monthly',
							kind: 'expense',
							postingMode: 'manual',
							startDate: '2026-05-01',
						},
						name: 'create_scheduled_transaction',
					},
				})
			);
		};
		const first = await create(1);
		const second = await create(2);
		const listed = await readJson<MCPScheduledJson>(
			await call({
				id: 3,
				jsonrpc: '2.0',
				method: 'tools/call',
				params: { arguments: {}, name: 'list_scheduled_transactions' },
			})
		);
		const forecast = await readJson<MCPScheduledJson>(
			await call({
				id: 4,
				jsonrpc: '2.0',
				method: 'tools/call',
				params: {
					arguments: { fromDate: '2026-05-01', toDate: '2026-07-01' },
					name: 'list_upcoming_scheduled_transactions',
				},
			})
		);
		const posted = await readJson<MCPScheduledJson>(
			await call({
				id: 5,
				jsonrpc: '2.0',
				method: 'tools/call',
				params: {
					arguments: { id: first.result.structuredContent.id },
					name: 'post_scheduled_transaction',
				},
			})
		);
		const skipped = await readJson<MCPScheduledJson>(
			await call({
				id: 6,
				jsonrpc: '2.0',
				method: 'tools/call',
				params: {
					arguments: { id: second.result.structuredContent.id },
					name: 'skip_scheduled_transaction',
				},
			})
		);
		const paused = await readJson<MCPScheduledJson>(
			await call({
				id: 7,
				jsonrpc: '2.0',
				method: 'tools/call',
				params: {
					arguments: { id: first.result.structuredContent.id, status: 'paused' },
					name: 'update_scheduled_transaction',
				},
			})
		);
		const deleted = await readJson<MCPScheduledJson>(
			await call({
				id: 8,
				jsonrpc: '2.0',
				method: 'tools/call',
				params: {
					arguments: { id: second.result.structuredContent.id },
					name: 'delete_scheduled_transaction',
				},
			})
		);

		expect(first.result.isError).toBe(false);
		expect(listed.result.structuredContent.items).toHaveLength(2);
		expect(forecast.result.structuredContent.total).toBe(6);
		expect(forecast.result.structuredContent.totals.expenseMinor).toBe(6000);
		expect(posted.result.structuredContent.transaction.transactionDate).toBe('2026-05-01');
		expect(posted.result.structuredContent.scheduledTransaction.nextDueDate).toBe('2026-06-01');
		expect(skipped.result.structuredContent.nextDueDate).toBe('2026-06-01');
		expect(paused.result.structuredContent.id).toBe(first.result.structuredContent.id);
		expect(deleted.result.isError).toBe(false);
	});
});
