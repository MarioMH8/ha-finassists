import { Buffer } from 'node:buffer';

import {
	CloseAccount,
	CreateAccount,
	GetAccountBalances,
	ListAccounts,
	ReopenAccount,
} from '@modules/accounts/application';
import { SqliteAccountRepository } from '@modules/accounts/infrastructure';
import { ArchiveBook, CreateBook, DeleteBook, EnsureDefaultBook, ListBooks } from '@modules/books/application';
import { SqliteBookRepository } from '@modules/books/infrastructure';
import { CreateBudget, GetBudgetReport, ListBudgets } from '@modules/budgets/application';
import {
	initializeBudgetSchema,
	SqliteBudgetActualsQuery,
	SqliteBudgetRepository,
} from '@modules/budgets/infrastructure';
import {
	ArchiveClassification,
	CreateClassification,
	DeleteClassification,
	ListClassifications,
	RestoreClassification,
	UpdateClassification,
} from '@modules/classifications/application';
import { SqliteCategoryRepository, SqliteClassRepository } from '@modules/classifications/infrastructure';
import { CommitStatementImport, PreviewStatementImport } from '@modules/imports/application';
import { DEFAULT_IMPORT_LIMITS } from '@modules/imports/domain';
import { QIF_BASIC } from '@modules/imports/fixtures';
import { SqliteStatementImportRepository } from '@modules/imports/infrastructure';
import {
	CreateTransaction,
	CreateTransfer,
	DeleteTransaction,
	ListTransactions,
	SetTransactionStatus,
	UpdateTransaction,
} from '@modules/ledger/application';
import { SqliteLedgerRepository } from '@modules/ledger/infrastructure';
import {
	ChangeScheduleStatus,
	CreateSchedule,
	GenerateScheduleOccurrences,
	ListScheduleOccurrences,
	ListSchedules,
	RecordScheduleOccurrence,
	UpdateSchedule,
} from '@modules/schedules/application';
import {
	initializeScheduleSchema,
	SqliteScheduleOccurrenceRepository,
	SqliteScheduleRepository,
} from '@modules/schedules/infrastructure';
import {
	CloseSharedExpense,
	CreateSharedExpense,
	CreateSharedExpenseParticipant,
	ListSharedExpenseParticipants,
	ListSharedExpenses,
	RemoveSharedExpenseParticipant,
	ReopenSharedExpense,
	SettleSharedExpense,
} from '@modules/shared-expenses/application';
import { initializeSharedExpenseSchema, SqliteSharedExpenseRepository } from '@modules/shared-expenses/infrastructure';
import { migrateDatabase } from '@modules/storage/infrastructure';
import { AuthenticateApiToken, IssueApiToken, ListApiTokens, RevokeApiToken } from '@modules/tokens/application';
import { SqliteApiTokenRepository, WebCryptoTokenCredentialService } from '@modules/tokens/infrastructure';
import { Database } from 'bun:sqlite';
import { afterEach, describe, expect, it } from 'bun:test';

import { handleMcpRequest, MCP_MAX_BODY_BYTES } from '../mcp/mcp-transport';
import { handleRequest } from '../routes';
import type { FinanceUseCases } from './finance-routes';
import { handleFinanceRequest } from './finance-routes';

const databases: Database[] = [];

interface IdentifiedJson {
	id: string;
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
		structuredContent: { canCommit: boolean; items: unknown[]; transactionIds: string[] };
		tools: { name: string }[];
	};
}
interface FinanceRouteActor {
	id: string;
	kind: 'home_assistant_integration' | 'home_assistant_user';
}

function createMigratedDatabase(): Database {
	const database = new Database(':memory:');
	migrateDatabase(database);

	return database;
}

function setup(): { database: Database; useCases: FinanceUseCases } {
	const database = new Database(':memory:');
	databases.push(database);
	migrateDatabase(database);
	initializeBudgetSchema(database);
	initializeScheduleSchema(database);
	initializeSharedExpenseSchema(database);
	const books = new SqliteBookRepository(database);
	new EnsureDefaultBook(books).execute();
	const accounts = new SqliteAccountRepository(database);
	const categories = new SqliteCategoryRepository(database);
	const classes = new SqliteClassRepository(database);
	const ledger = new SqliteLedgerRepository(database);
	const imports = new SqliteStatementImportRepository(database);
	const budgets = new SqliteBudgetRepository(database);
	const budgetActuals = new SqliteBudgetActualsQuery(database);
	const schedules = new SqliteScheduleRepository(database);
	const occurrences = new SqliteScheduleOccurrenceRepository(database);
	const sharedExpenses = new SqliteSharedExpenseRepository(database);
	const useCases: FinanceUseCases = {
		accounts: {
			balances: new GetAccountBalances(accounts, accounts, books),
			close: new CloseAccount(accounts),
			create: new CreateAccount(accounts, books),
			list: new ListAccounts(accounts),
			open: new ReopenAccount(accounts),
		},
		books: {
			archive: new ArchiveBook(books),
			create: new CreateBook(books),
			delete: new DeleteBook(books),
			list: new ListBooks(books),
		},
		budgets: {
			create: new CreateBudget(budgets, books, accounts, categories, classes),
			getReport: new GetBudgetReport(budgets, budgetActuals),
			list: new ListBudgets(budgets),
		},
		classifications: {
			archive: { category: new ArchiveClassification(categories), class: new ArchiveClassification(classes) },
			create: { category: new CreateClassification(categories), class: new CreateClassification(classes) },
			delete: { category: new DeleteClassification(categories), class: new DeleteClassification(classes) },
			list: { category: new ListClassifications(categories), class: new ListClassifications(classes) },
			restore: { category: new RestoreClassification(categories), class: new RestoreClassification(classes) },
			update: { category: new UpdateClassification(categories), class: new UpdateClassification(classes) },
		},
		imports: {
			commit: new CommitStatementImport({ accounts, books, imports, ledger }),
			preview: new PreviewStatementImport({ accounts, books, imports }),
		},
		ledger: {
			create: new CreateTransaction(ledger),
			createTransfer: new CreateTransfer(ledger),
			delete: new DeleteTransaction(ledger),
			list: new ListTransactions(ledger),
			setStatus: new SetTransactionStatus(ledger),
			update: new UpdateTransaction(ledger),
		},
		schedules: {
			changeStatus: new ChangeScheduleStatus(schedules),
			create: new CreateSchedule(schedules),
			generateOccurrences: new GenerateScheduleOccurrences(schedules, occurrences),
			list: new ListSchedules(schedules),
			listOccurrences: new ListScheduleOccurrences(schedules, occurrences),
			recordOccurrence: new RecordScheduleOccurrence(schedules, occurrences, ledger),
			update: new UpdateSchedule(schedules),
		},
		sharedExpenses: {
			close: new CloseSharedExpense(sharedExpenses),
			create: new CreateSharedExpense(sharedExpenses, books),
			createParticipant: new CreateSharedExpenseParticipant(sharedExpenses, books),
			list: new ListSharedExpenses(sharedExpenses),
			listParticipants: new ListSharedExpenseParticipants(sharedExpenses),
			removeParticipant: new RemoveSharedExpenseParticipant(sharedExpenses),
			reopen: new ReopenSharedExpense(sharedExpenses),
			settle: new SettleSharedExpense(sharedExpenses),
		},
	};

	return { database, useCases };
}

async function readJson<T>(response: Response): Promise<T> {
	return JSON.parse(await response.text()) as T;
}

async function send(
	useCases: FinanceUseCases,
	pathname: string,
	method = 'GET',
	body?: unknown,
	actor?: FinanceRouteActor
): Promise<Response> {
	return handleFinanceRequest(
		new Request(`http://localhost${pathname}`, {
			method,
			...(body !== undefined && { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }),
		}),
		actor ?? { id: 'actor-123', kind: 'home_assistant_user' },
		useCases
	);
}

afterEach(() => {
	for (const database of databases) {
		database.close();
	}
	databases.length = 0;
});

describe('finance REST routes', () => {
	it('creates a book and account, then records an exactly serialized transaction with actor attribution', async () => {
		const { useCases } = setup();
		const createdBook = await send(useCases, '/api/v1/books', 'POST', { currencyCode: 'JPY', name: 'Travel' });
		const book = await readJson<IdentifiedJson>(createdBook);
		expect(createdBook.status).toBe(201);
		const createdAccount = await send(useCases, `/api/v1/books/${book.id}/accounts`, 'POST', {
			kind: 'checking',
			name: 'Cash',
			openingBalanceMinor: 100,
		});
		const account = await readJson<IdentifiedJson>(createdAccount);
		expect(createdAccount.status).toBe(201);
		const transactionResponse = await send(useCases, `/api/v1/books/${book.id}/transactions`, 'POST', {
			accountId: account.id,
			amountMinor: -25,
			payee: 'Coffee',
			transactionDate: '2025-02-01',
		});
		const transaction = await readJson<{ actorId: string; amountMinor: number }>(transactionResponse);

		expect(transactionResponse.status).toBe(201);
		expect(transaction.amountMinor).toBe(-25);
		expect(transaction.actorId).toBe('actor-123');
		const balanceResponse = await send(useCases, `/api/v1/books/${book.id}/accounts/${account.id}/balances`);
		const filtered = await send(
			useCases,
			`/api/v1/books/${book.id}/transactions?accountId=${account.id}&fromDate=2025-02-01&status=uncleared`
		);
		const balanceBody = await readJson<{ postedMinor: number; reconciledMinor: number; totalMinor: number }>(
			balanceResponse
		);
		expect(balanceBody).toEqual({ postedMinor: 100, reconciledMinor: 100, totalMinor: 75 });
		const filteredBody = await readJson<PaginatedJson<unknown>>(filtered);
		expect(filteredBody.items).toHaveLength(1);
	});

	it('persists the Home Assistant integration identity for shared expenses and settlements', async () => {
		const { database, useCases } = setup();
		const integrationActor: FinanceRouteActor = {
			id: 'home-assistant-integration',
			kind: 'home_assistant_integration',
		};
		const participant = await send(useCases, '/api/v1/books/default/shared-expense-participants', 'POST', {
			id: 'integration-participant',
			name: 'Integration participant',
		});
		const expenseResponse = await send(
			useCases,
			'/api/v1/books/default/shared-expenses',
			'POST',
			{ amountMinor: 12, description: 'Integration expense', participantIds: ['integration-participant'] },
			integrationActor
		);
		const expense = await readJson<IdentifiedJson>(expenseResponse);
		const settlementResponse = await send(
			useCases,
			`/api/v1/books/default/shared-expenses/${expense.id}/settle`,
			'POST',
			{ participantId: 'integration-participant' },
			integrationActor
		);
		const storedExpense = database
			.query('SELECT actor_kind, actor_id FROM shared_expenses WHERE id = ?')
			.get(expense.id) as { actor_id: string; actor_kind: string };
		const storedSettlement = database
			.query(
				'SELECT settled_by_actor_kind, settled_by_actor_id FROM shared_expense_settlements WHERE expense_id = ?'
			)
			.get(expense.id) as { settled_by_actor_id: string; settled_by_actor_kind: string };

		expect(participant.status).toBe(201);
		expect(expenseResponse.status).toBe(201);
		expect(settlementResponse.status).toBe(204);
		expect(storedExpense).toEqual({ actor_id: integrationActor.id, actor_kind: integrationActor.kind });
		expect(storedSettlement).toEqual({
			settled_by_actor_id: integrationActor.id,
			settled_by_actor_kind: integrationActor.kind,
		});
	});

	it('exposes budget reports, scheduled occurrences, and actor-attributed shared expense settlements', async () => {
		const { useCases } = setup();
		const account = useCases.accounts.create.execute({
			bookId: 'default',
			kind: 'checking',
			name: 'Checking',
			openingBalanceMinor: 0,
		});
		const budgetResponse = await send(useCases, '/api/v1/books/default/budgets', 'POST', {
			accountId: account.id,
			name: 'February',
			periodEnd: '2025-02-28',
			periodStart: '2025-02-01',
			plannedMinor: 100,
		});
		const budget = await readJson<IdentifiedJson>(budgetResponse);
		const transaction = useCases.ledger.create.execute({
			accountId: account.id,
			actorId: 'actor-123',
			amountMinor: -25,
			bookId: 'default',
			transactionDate: '2025-02-14',
		});
		useCases.ledger.setStatus.execute('default', transaction.id, 'cleared');
		const reportResponse = await send(useCases, `/api/v1/books/default/budgets/${budget.id}/report`);
		const report = await readJson<{ actualMinor: number; remainingMinor: number }>(reportResponse);
		const participantOne = await send(useCases, '/api/v1/books/default/shared-expense-participants', 'POST', {
			id: 'person-a',
			name: 'Person A',
		});
		const participantTwo = await send(useCases, '/api/v1/books/default/shared-expense-participants', 'POST', {
			id: 'person-b',
			name: 'Person B',
		});
		const expenseResponse = await send(useCases, '/api/v1/books/default/shared-expenses', 'POST', {
			amountMinor: 9,
			description: 'Dinner',
			participantIds: ['person-a', 'person-b'],
		});
		const expense = await readJson<{
			actor: { id: string };
			allocations: { amountMinor: number }[];
			id: string;
		}>(expenseResponse);
		const settlement = await send(useCases, `/api/v1/books/default/shared-expenses/${expense.id}/settle`, 'POST', {
			participantId: 'person-a',
		});
		const scheduleResponse = await send(useCases, '/api/v1/books/default/schedules', 'POST', {
			accountId: account.id,
			amountMinor: -10,
			frequency: 'one_time',
			startDate: '2025-02-15',
		});
		const schedule = await readJson<IdentifiedJson>(scheduleResponse);
		const occurrencesResponse = await send(
			useCases,
			`/api/v1/books/default/schedules/${schedule.id}/occurrences`,
			'POST',
			{ throughDate: '2025-02-15' }
		);
		const occurrences = await readJson<IdentifiedJson[]>(occurrencesResponse);
		const [occurrence] = occurrences;
		const scheduledTransaction = useCases.ledger.create.execute({
			accountId: account.id,
			actorId: 'actor-123',
			amountMinor: -10,
			bookId: 'default',
			transactionDate: '2025-02-15',
		});
		const recorded = await send(
			useCases,
			`/api/v1/books/default/schedule-occurrences/${occurrence.id}/record`,
			'POST',
			{ transactionId: scheduledTransaction.id }
		);
		const listedOccurrences = await send(useCases, `/api/v1/books/default/schedules/${schedule.id}/occurrences`);

		expect(budgetResponse.status).toBe(201);
		expect([report.actualMinor, report.remainingMinor]).toEqual([25, 75]);
		expect(participantOne.status).toBe(201);
		expect(participantTwo.status).toBe(201);
		expect(expenseResponse.status).toBe(201);
		expect(expense.actor.id).toBe('actor-123');
		expect(
			expense.allocations.reduce(
				(sum: number, allocation: { amountMinor: number }) => sum + allocation.amountMinor,
				0
			)
		).toBe(9);
		expect(settlement.status).toBe(204);
		expect(scheduleResponse.status).toBe(201);
		expect(occurrencesResponse.status).toBe(200);
		expect(occurrencesResponse.headers.get('content-type')).toContain('application/json');
		expect(recorded.status).toBe(200);
		const recordedBody = await readJson<{ transactionId: string }>(recorded);
		expect(recordedBody.transactionId).toBe(scheduledTransaction.id);
		expect(listedOccurrences.status).toBe(200);
		const listedOccurrencesBody =
			await readJson<
				PaginatedJson<IdentifiedJson & { recordedAt: string; status: string; transactionId: string }>
			>(listedOccurrences);
		const listedOccurrence = listedOccurrencesBody.items[0];
		const { recordedAt, ...listedOccurrenceWithoutRecordedAt } = listedOccurrence;
		expect(typeof recordedAt).toBe('string');
		expect(listedOccurrenceWithoutRecordedAt).toEqual({
			...occurrence,
			status: 'recorded',
			transactionId: scheduledTransaction.id,
		});
		expect(listedOccurrencesBody).toMatchObject({ limit: 100, offset: 0, total: 1 });
	});

	it('paginates lists, filters transactions, and reports unsupported methods', async () => {
		const { useCases } = setup();
		await send(useCases, '/api/v1/books', 'POST', { currencyCode: 'USD', name: 'Travel' });
		await send(useCases, '/api/v1/books', 'POST', { currencyCode: 'USD', name: 'Savings' });
		const page = await send(useCases, '/api/v1/books?limit=1&offset=1');
		const pageBody = await readJson<PaginatedJson<unknown>>(page);
		const invalidPage = await send(useCases, '/api/v1/books?limit=0');
		const methodNotAllowed = await send(useCases, '/api/v1/books', 'DELETE');

		expect(pageBody.items).toHaveLength(1);
		expect(pageBody.limit).toBe(1);
		expect(pageBody.offset).toBe(1);
		expect(pageBody.total).toBe(3);
		expect(invalidPage.status).toBe(400);
		expect(methodNotAllowed.status).toBe(405);
		expect(methodNotAllowed.headers.get('allow')).toBe('GET, POST');
	});

	it('answers unknown routes with 404, reports the allowed methods per route, and tolerates trailing slashes', async () => {
		const { useCases } = setup();
		const unknown = await send(useCases, '/api/v1/books/default/unknown');
		const wrongMethod = await send(useCases, '/api/v1/books/default/transactions/tx-1/status', 'POST');
		const trailingSlash = await send(useCases, '/api/v1/books/');

		expect(unknown.status).toBe(404);
		expect(wrongMethod.status).toBe(405);
		expect(wrongMethod.headers.get('allow')).toBe('PUT');
		expect(trailingSlash.status).toBe(200);
	});

	it('rejects wrongly typed fields with a descriptive 400', async () => {
		const { useCases } = setup();
		const wrongName = await send(useCases, '/api/v1/books', 'POST', { currencyCode: 'USD', name: 42 });
		const wrongBody = await send(useCases, '/api/v1/books', 'POST', ['USD']);
		const wrongOptional = await send(useCases, '/api/v1/books/default/schedules', 'POST', {
			accountId: 'account',
			amountMinor: 100,
			frequency: 'monthly',
			memo: 5,
			startDate: '2025-01-01',
		});
		const wrongFrequency = await send(useCases, '/api/v1/books/default/schedules', 'POST', {
			accountId: 'account',
			amountMinor: 100,
			frequency: 'sometimes',
			startDate: '2025-01-01',
		});

		expect(wrongName.status).toBe(400);
		expect(await readJson<{ error: string }>(wrongName)).toEqual({ error: 'name must be a non-empty string' });
		expect(wrongBody.status).toBe(400);
		expect(wrongOptional.status).toBe(400);
		expect(wrongFrequency.status).toBe(400);
		expect(await readJson<{ error: string }>(wrongFrequency)).toEqual({ error: 'frequency is invalid' });
	});

	it('previews and commits statement imports through the authenticated actor', async () => {
		const { useCases } = setup();
		const account = useCases.accounts.create.execute({
			bookId: 'default',
			kind: 'checking',
			name: 'Checking',
			openingBalanceMinor: 0,
		});
		const sendImport = async (action: 'commit' | 'preview', file: File) => {
			const form = new FormData();
			form.set('accountId', account.id);
			form.set('format', 'qif');
			form.set('file', file);

			return handleFinanceRequest(
				new Request(`http://localhost/api/v1/books/default/imports/${action}`, { body: form, method: 'POST' }),
				{ id: 'actor-123' },
				useCases
			);
		};
		const preview = await sendImport('preview', new File([QIF_BASIC], 'statement.qif'));
		const previewBody = await readJson<{ canCommit: boolean }>(preview);
		const committed = await sendImport('commit', new File([QIF_BASIC], 'statement.qif'));
		const commitBody = await readJson<{ status: string; transactionIds: string[] }>(committed);
		const imported = useCases.ledger.list.execute('default', account.id);

		expect(preview.status).toBe(200);
		expect(previewBody.canCommit).toBe(true);
		expect(committed.status).toBe(201);
		expect(commitBody.status).toBe('imported');
		expect(commitBody.transactionIds).toHaveLength(2);
		expect(imported.every(transaction => transaction.actorId === 'actor-123')).toBe(true);
	});

	it('rejects statement files larger than the parser limit', async () => {
		const { useCases } = setup();
		const account = useCases.accounts.create.execute({
			bookId: 'default',
			kind: 'checking',
			name: 'Checking',
			openingBalanceMinor: 0,
		});
		const form = new FormData();
		form.set('accountId', account.id);
		form.set('format', 'qif');
		form.set('file', new File([new Uint8Array(DEFAULT_IMPORT_LIMITS.maxBytes + 1)], 'large.qif'));
		const response = await handleFinanceRequest(
			new Request('http://localhost/api/v1/books/default/imports/preview', { body: form, method: 'POST' }),
			{ id: 'actor-123' },
			useCases
		);

		expect(response.status).toBe(413);
	});

	it('returns validation and book-isolation errors without leaking storage details', async () => {
		const { useCases } = setup();
		const booksResponse = await send(useCases, '/api/v1/books', 'GET');
		const booksPage = await readJson<PaginatedJson<IdentifiedJson>>(booksResponse);
		const book = booksPage.items[0];
		const response = await send(useCases, `/api/v1/books/${book.id}/transactions`, 'POST', {
			accountId: 'missing',
			amountMinor: 1,
			transactionDate: '2025-02-30',
		});
		const body = await readJson<{ error: string }>(response);
		const malformed = await handleFinanceRequest(
			new Request('http://localhost/api/v1/books', { body: '{', method: 'POST' }),
			{ id: 'actor-123' },
			useCases
		);

		expect(response.status).toBe(400);
		expect(body.error).toContain('valid calendar date');
		expect(JSON.stringify(body)).not.toContain('SQLITE');
		expect(malformed.status).toBe(400);
	});

	it('serves stateless MCP tools only with a valid bearer token', async () => {
		const { useCases } = setup();
		const tokenRepository = new SqliteApiTokenRepository(createMigratedDatabase());
		const credentialService = new WebCryptoTokenCredentialService();
		const tokenUseCases = {
			authenticate: new AuthenticateApiToken(tokenRepository, credentialService),
			issue: new IssueApiToken(tokenRepository, credentialService),
			list: new ListApiTokens(tokenRepository),
			revoke: new RevokeApiToken(tokenRepository),
		};
		const httpContext = { remoteAddress: '127.0.0.1', trustedIngressIp: '127.0.0.1' };
		const unauthorized = await handleRequest(
			new Request('http://localhost/mcp', {
				body: JSON.stringify({
					id: 1,
					jsonrpc: '2.0',
					method: 'initialize',
					params: { protocolVersion: '2025-11-25' },
				}),
				headers: { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' },
				method: 'POST',
			}),
			httpContext,
			tokenUseCases,
			useCases
		);
		expect(unauthorized.status).toBe(401);
		const issued = await tokenUseCases.issue.execute({ name: 'MCP client', ownerId: 'mcp-owner' });
		const honoMcpResponse = await handleRequest(
			new Request('http://localhost/mcp', {
				body: JSON.stringify({ id: 1, jsonrpc: '2.0', method: 'tools/list' }),
				headers: {
					Accept: 'application/json, text/event-stream',
					Authorization: `Bearer ${issued.secret}`,
					'Content-Type': 'application/json',
				},
				method: 'POST',
			}),
			httpContext,
			tokenUseCases,
			useCases
		);
		expect(honoMcpResponse.status).toBe(200);
		expect(honoMcpResponse.headers.get('content-security-policy')).toContain('default-src');
		const honoRestResponse = await handleRequest(
			new Request('http://localhost/api/v1/books', {
				headers: { Authorization: `Bearer ${issued.secret}` },
			}),
			{ remoteAddress: '127.0.0.1', trustedIngressIp: '::1' },
			tokenUseCases,
			useCases
		);
		expect(honoRestResponse.status).toBe(200);
		const honoRestBody = await readJson<PaginatedJson<unknown>>(honoRestResponse);
		expect(honoRestBody.total).toBe(1);
		const call = async (message: unknown, extraHeaders: Record<string, string> = {}) =>
			handleMcpRequest(
				new Request('http://localhost/mcp', {
					body: JSON.stringify(message),
					headers: {
						Accept: 'application/json, text/event-stream',
						Authorization: `Bearer ${issued.secret}`,
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
		const initializedBody = await readJson<MCPJson>(initialized);
		const listed = await call({ id: 2, jsonrpc: '2.0', method: 'tools/list' });
		const callResult = await call({
			id: 3,
			jsonrpc: '2.0',
			method: 'tools/call',
			params: { arguments: {}, name: 'list_books' },
		});
		const callBody = await readJson<MCPJson>(callResult);
		const listedClone = listed.clone();
		const listedBody = await readJson<MCPJson>(listedClone);
		const toolNames = listedBody.result.tools.map(tool => tool.name);
		const budgetList = await call({
			id: 7,
			jsonrpc: '2.0',
			method: 'tools/call',
			params: { arguments: { bookId: 'default' }, name: 'list_budgets' },
		});
		const scheduleList = await call({
			id: 8,
			jsonrpc: '2.0',
			method: 'tools/call',
			params: { arguments: { bookId: 'default' }, name: 'list_schedules' },
		});
		const sharedExpenseList = await call({
			id: 9,
			jsonrpc: '2.0',
			method: 'tools/call',
			params: { arguments: { bookId: 'default' }, name: 'list_shared_expenses' },
		});

		expect(initialized.status).toBe(200);
		expect(initializedBody.result.serverInfo.name).toBe('fin-assist');
		expect(initialized.headers.get('mcp-session-id')).toBeNull();
		expect(listed.status).toBe(200);
		const listedResult = await readJson<MCPJson>(listed);
		expect(listedResult.result.tools.length).toBeGreaterThan(0);
		expect(toolNames).toContain('create_budget');
		expect(toolNames).toContain('generate_schedule_occurrences');
		expect(toolNames).toContain('create_shared_expense');
		const budgetListBody = await readJson<MCPJson>(budgetList);
		const scheduleListBody = await readJson<MCPJson>(scheduleList);
		const sharedExpenseListBody = await readJson<MCPJson>(sharedExpenseList);
		expect(budgetListBody.result.isError).toBe(false);
		expect(scheduleListBody.result.isError).toBe(false);
		expect(sharedExpenseListBody.result.isError).toBe(false);
		expect(callResult.status).toBe(200);
		expect(callBody.result.isError).toBe(false);
		expect(callBody.result.structuredContent.items).toHaveLength(1);

		const notification = await call({ jsonrpc: '2.0', method: 'notifications/initialized' });
		const invalidOrigin = await call(
			{ id: 5, jsonrpc: '2.0', method: 'ping' },
			{ Origin: 'https://untrusted.example' }
		);
		const unacceptable = await call({ id: 6, jsonrpc: '2.0', method: 'ping' }, { Accept: 'application/json' });
		const responseToGet = await handleMcpRequest(new Request('http://localhost/mcp'), tokenUseCases, useCases);
		expect(notification.status).toBe(202);
		expect(await notification.text()).toBe('');
		expect(invalidOrigin.status).toBe(403);
		expect(unacceptable.status).toBe(406);
		expect(responseToGet.status).toBe(405);

		await tokenUseCases.revoke.execute({ id: issued.token.id, ownerId: 'mcp-owner' });
		const revoked = await call({ id: 4, jsonrpc: '2.0', method: 'tools/list' });
		expect(revoked.status).toBe(401);
	});

	it('executes statement import tools with token-owner attribution and validates MCP requests', async () => {
		const { useCases } = setup();
		const account = useCases.accounts.create.execute({
			bookId: 'default',
			kind: 'checking',
			name: 'Checking',
			openingBalanceMinor: 0,
		});
		const tokenRepository = new SqliteApiTokenRepository(createMigratedDatabase());
		const credentialService = new WebCryptoTokenCredentialService();
		const tokenUseCases = {
			authenticate: new AuthenticateApiToken(tokenRepository, credentialService),
			issue: new IssueApiToken(tokenRepository, credentialService),
			list: new ListApiTokens(tokenRepository),
			revoke: new RevokeApiToken(tokenRepository),
		};
		const issued = await tokenUseCases.issue.execute({ name: 'Import client', ownerId: 'token-owner' });
		const call = (message: unknown, protocolVersion = '2025-11-25') =>
			handleMcpRequest(
				new Request('http://localhost/mcp', {
					body: JSON.stringify(message),
					headers: {
						Accept: 'application/json, text/event-stream',
						Authorization: `Bearer ${issued.secret}`,
						'Content-Type': 'application/json',
						'MCP-Protocol-Version': protocolVersion,
					},
					method: 'POST',
				}),
				tokenUseCases,
				useCases
			);
		const contentBase64 = Buffer.from(QIF_BASIC).toString('base64');
		const preview = await call({
			id: 1,
			jsonrpc: '2.0',
			method: 'tools/call',
			params: {
				arguments: { accountId: account.id, bookId: 'default', contentBase64, format: 'qif' },
				name: 'preview_statement_import',
			},
		});
		const previewResult = await readJson<MCPJson>(preview);
		const committed = await call({
			id: 2,
			jsonrpc: '2.0',
			method: 'tools/call',
			params: {
				arguments: { accountId: account.id, bookId: 'default', contentBase64, format: 'qif' },
				name: 'commit_statement_import',
			},
		});
		const commitResult = await readJson<MCPJson>(committed);
		const ledger = useCases.ledger.list.execute('default', account.id);
		const unsupportedVersion = await call({ id: 3, jsonrpc: '2.0', method: 'tools/list' }, 'unsupported-version');
		const unsupportedBody = await readJson<MCPJson>(unsupportedVersion);
		const malformed = await handleMcpRequest(
			new Request('http://localhost/mcp', {
				body: '{',
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
		const tooLarge = await handleMcpRequest(
			new Request('http://localhost/mcp', {
				body: ' '.repeat(MCP_MAX_BODY_BYTES + 1),
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

		expect(previewResult.result.isError).toBe(false);
		expect(previewResult.result.structuredContent.canCommit).toBe(true);
		expect(commitResult.result.isError).toBe(false);
		expect(commitResult.result.structuredContent.transactionIds).toHaveLength(2);
		expect(ledger.every(transaction => transaction.actorId === 'token-owner')).toBe(true);
		expect(unsupportedBody.error.code).toBe(-32_600);
		expect(malformed.status).toBe(200);
		const malformedBody = await readJson<MCPJson>(malformed);
		expect(malformedBody.error.code).toBe(-32_700);
		expect(tooLarge.status).toBe(413);
	});
});
