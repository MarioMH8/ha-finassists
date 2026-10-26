import { handleMcpRequest, MCP_MAX_BODY_BYTES } from '@modules/api/infrastructure/http/mcp/mcp-transport';
import { handleRequest } from '@modules/api/infrastructure/http/routes';
import { createHttpContainer } from '@modules/api/infrastructure/http/shared/http-container';
import {
	CreateTransaction,
	DeleteTransaction,
	DeleteTransactions,
	ListTransactions,
	UpdateTransaction,
} from '@modules/ledger/application';
import { SqliteCategoryRepository, SqliteLedgerRepository } from '@modules/ledger/infrastructure';
import { migrateDatabase } from '@modules/storage/infrastructure';
import { AuthenticateApiToken, IssueApiToken, ListApiTokens, RevokeApiToken } from '@modules/tokens/application';
import { SqliteApiTokenRepository, WebCryptoTokenCredentialService } from '@modules/tokens/infrastructure';
import { Database } from 'bun:sqlite';
import { afterEach, describe, expect, it } from 'bun:test';

import type { FinanceUseCases } from './finance-routes';
import { handleFinanceRequest } from './finance-routes';

const databases: Database[] = [];

interface TransactionJson {
	actorId: null | string;
	amountMinor: number;
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

	return {
		useCases: {
			ledger: {
				create: new CreateTransaction(repository, categoryRepository, 'EUR'),
				delete: new DeleteTransaction(repository),
				deleteMany: new DeleteTransactions(repository),
				list: new ListTransactions(repository),
				update: new UpdateTransaction(repository, categoryRepository),
			},
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
			'create_transaction',
			'delete_transaction',
			'list_transactions',
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
