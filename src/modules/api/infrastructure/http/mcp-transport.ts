import { Buffer } from 'node:buffer';

import type { ImportFormat } from '@modules/imports/domain';
import { DEFAULT_IMPORT_LIMITS, IMPORT_FORMATS, ImportError } from '@modules/imports/domain';

import type { FinanceUseCases } from './finance-routes';
import { handleFinanceRequest } from './finance-routes';
import type { SystemCredentialUseCases, TokenManagementUseCases } from './routes';

const MCP_PROTOCOL_VERSION = {
	CURRENT: '2025-11-25',
} as const;
const MCP_MAX_BODY_BYTES = 6 * 1024 * 1024;
const JSON_RPC_NULL = JSON.parse('null') as null;
const MCP_SERVER_INFO = { name: 'fin-assist', version: '0.1.0' };

interface JsonRpcRequest {
	id?: number | string;
	jsonrpc: '2.0';
	method: string;
	params?: unknown;
}

interface McpTool {
	description: string;
	inputSchema: { properties: Record<string, unknown>; required?: string[]; type: 'object' };
	name: string;
}

const TOOLS: McpTool[] = [
	{ description: 'List the household finance books.', inputSchema: objectSchema(), name: 'list_books' },
	{
		description: 'Create an isolated finance book.',
		inputSchema: objectSchema(
			{ currencyCode: stringProperty('ISO 4217 currency code'), name: stringProperty('Book name') },
			['currencyCode', 'name']
		),
		name: 'create_book',
	},
	{
		description: 'List accounts in a book.',
		inputSchema: objectSchema(
			{ bookId: stringProperty('Book ID'), includeClosed: booleanProperty('Include closed accounts') },
			['bookId']
		),
		name: 'list_accounts',
	},
	{
		description: 'Create an account in its book currency.',
		inputSchema: objectSchema(
			{
				bookId: stringProperty('Book ID'),
				kind: stringProperty('Account kind'),
				name: stringProperty('Account name'),
				openingBalanceMinor: integerProperty('Opening balance in exact minor units'),
			},
			['bookId', 'kind', 'name', 'openingBalanceMinor']
		),
		name: 'create_account',
	},
	{
		description: 'Close an account without deleting its ledger.',
		inputSchema: objectSchema({ accountId: stringProperty('Account ID'), bookId: stringProperty('Book ID') }, [
			'accountId',
			'bookId',
		]),
		name: 'close_account',
	},
	{
		description: 'Reopen a previously closed account.',
		inputSchema: objectSchema({ accountId: stringProperty('Account ID'), bookId: stringProperty('Book ID') }, [
			'accountId',
			'bookId',
		]),
		name: 'reopen_account',
	},
	{
		description: 'Create a category, optionally under a parent category.',
		inputSchema: objectSchema(
			{
				bookId: stringProperty('Book ID'),
				name: stringProperty('Category name'),
				parentId: stringProperty('Optional parent category ID'),
			},
			['bookId', 'name']
		),
		name: 'create_category',
	},
	{
		description: 'Create a class, optionally under a parent class.',
		inputSchema: objectSchema(
			{
				bookId: stringProperty('Book ID'),
				name: stringProperty('Class name'),
				parentId: stringProperty('Optional parent class ID'),
			},
			['bookId', 'name']
		),
		name: 'create_class',
	},
	{
		description: 'Update a category name or parent.',
		inputSchema: objectSchema(
			{
				bookId: stringProperty('Book ID'),
				classificationId: stringProperty('Category ID'),
				name: stringProperty('Optional category name'),
				parentId: stringProperty('Optional parent category ID'),
			},
			['bookId', 'classificationId']
		),
		name: 'update_category',
	},
	{
		description: 'Archive a category and its descendants.',
		inputSchema: objectSchema(
			{ bookId: stringProperty('Book ID'), classificationId: stringProperty('Category ID') },
			['bookId', 'classificationId']
		),
		name: 'archive_category',
	},
	{
		description: 'Restore an archived category hierarchy.',
		inputSchema: objectSchema(
			{ bookId: stringProperty('Book ID'), classificationId: stringProperty('Category ID') },
			['bookId', 'classificationId']
		),
		name: 'restore_category',
	},
	{
		description: 'Update a class name or parent.',
		inputSchema: objectSchema(
			{
				bookId: stringProperty('Book ID'),
				classificationId: stringProperty('Class ID'),
				name: stringProperty('Optional class name'),
				parentId: stringProperty('Optional parent class ID'),
			},
			['bookId', 'classificationId']
		),
		name: 'update_class',
	},
	{
		description: 'Archive a class and its descendants.',
		inputSchema: objectSchema({ bookId: stringProperty('Book ID'), classificationId: stringProperty('Class ID') }, [
			'bookId',
			'classificationId',
		]),
		name: 'archive_class',
	},
	{
		description: 'Restore an archived class hierarchy.',
		inputSchema: objectSchema({ bookId: stringProperty('Book ID'), classificationId: stringProperty('Class ID') }, [
			'bookId',
			'classificationId',
		]),
		name: 'restore_class',
	},

	{
		description: 'Get total, posted, and reconciled balances as exact minor-unit integers.',
		inputSchema: objectSchema(
			{
				accountId: stringProperty('Account ID'),
				asOf: stringProperty('Optional inclusive YYYY-MM-DD date'),
				bookId: stringProperty('Book ID'),
			},
			['accountId', 'bookId']
		),
		name: 'get_account_balances',
	},
	{
		description: 'Validate and preview a QIF or CSV statement without writing ledger rows.',
		inputSchema: objectSchema(
			{
				accountId: stringProperty('Target account ID'),
				bookId: stringProperty('Book ID'),
				contentBase64: stringProperty('Base64-encoded file contents, at most 2 MiB'),
				format: stringProperty('qif, payee_csv, or statement_csv'),
				payeeDirectoryBase64: stringProperty('Optional base64-encoded payee directory CSV'),
			},
			['accountId', 'bookId', 'contentBase64', 'format']
		),
		name: 'preview_statement_import',
	},
	{
		description: 'Import a previously previewed statement into its target account.',
		inputSchema: objectSchema(
			{
				accountId: stringProperty('Target account ID'),
				bookId: stringProperty('Book ID'),
				contentBase64: stringProperty('Base64-encoded file contents, at most 2 MiB'),
				format: stringProperty('qif, payee_csv, or statement_csv'),
				payeeDirectoryBase64: stringProperty('Optional base64-encoded payee directory CSV'),
			},
			['accountId', 'bookId', 'contentBase64', 'format']
		),
		name: 'commit_statement_import',
	},
	{
		description: 'List categories in a book.',
		inputSchema: objectSchema(
			{ bookId: stringProperty('Book ID'), includeArchived: booleanProperty('Include archived categories') },
			['bookId']
		),
		name: 'list_categories',
	},
	{
		description: 'List classes in a book.',
		inputSchema: objectSchema(
			{ bookId: stringProperty('Book ID'), includeArchived: booleanProperty('Include archived classes') },
			['bookId']
		),
		name: 'list_classes',
	},
	{
		description: 'List transactions for one account in a book.',
		inputSchema: objectSchema(
			{
				accountId: stringProperty('Account ID'),
				bookId: stringProperty('Book ID'),
				fromDate: stringProperty('Optional inclusive YYYY-MM-DD start date'),
				status: stringProperty('Optional transaction status'),
				toDate: stringProperty('Optional inclusive YYYY-MM-DD end date'),
			},
			['accountId', 'bookId']
		),
		name: 'list_transactions',
	},
	{
		description: 'Record a transaction; amountMinor is an exact signed integer.',
		inputSchema: objectSchema(
			{
				accountId: stringProperty('Account ID'),
				amountMinor: integerProperty('Signed minor units'),
				bookId: stringProperty('Book ID'),
				memo: stringProperty('Optional memo'),
				parts: transactionPartsProperty(),
				payee: stringProperty('Optional payee'),
				transactionDate: stringProperty('YYYY-MM-DD'),
			},
			['accountId', 'amountMinor', 'bookId', 'transactionDate']
		),
		name: 'create_transaction',
	},
	{
		description: 'Update an uncleared or cleared transaction.',
		inputSchema: objectSchema(
			{
				accountId: stringProperty('Optional account ID'),
				amountMinor: integerProperty('Optional signed minor units'),
				bookId: stringProperty('Book ID'),
				memo: stringProperty('Optional memo'),
				parts: transactionPartsProperty(),
				payee: stringProperty('Optional payee'),
				transactionDate: stringProperty('Optional YYYY-MM-DD date'),
				transactionId: stringProperty('Transaction ID'),
			},
			['bookId', 'transactionId']
		),
		name: 'update_transaction',
	},
	{
		description: 'Transfer exact minor units between accounts in one book.',
		inputSchema: objectSchema(
			{
				amountMinor: integerProperty('Positive minor units'),
				bookId: stringProperty('Book ID'),
				fromAccountId: stringProperty('Source account ID'),
				memo: stringProperty('Optional memo'),
				toAccountId: stringProperty('Destination account ID'),
				transactionDate: stringProperty('YYYY-MM-DD'),
			},
			['amountMinor', 'bookId', 'fromAccountId', 'toAccountId', 'transactionDate']
		),
		name: 'create_transfer',
	},
	{
		description: 'Move a transaction through supported uncleared, cleared, and reconciled states.',
		inputSchema: objectSchema(
			{
				bookId: stringProperty('Book ID'),
				status: stringProperty('Target status'),
				transactionId: stringProperty('Transaction ID'),
			},
			['bookId', 'status', 'transactionId']
		),
		name: 'set_transaction_status',
	},
	{
		description: 'Delete a non-reconciled transaction.',
		inputSchema: objectSchema(
			{ bookId: stringProperty('Book ID'), transactionId: stringProperty('Transaction ID') },
			['bookId', 'transactionId']
		),
		name: 'delete_transaction',
	},
	{
		description: 'List budgets in a book, optionally filtered by account.',
		inputSchema: objectSchema(
			{ accountId: stringProperty('Optional account ID'), bookId: stringProperty('Book ID') },
			['bookId']
		),
		name: 'list_budgets',
	},
	{
		description: 'Create a budget for an inclusive date period using exact minor units.',
		inputSchema: objectSchema(
			{
				accountId: stringProperty('Account ID'),
				bookId: stringProperty('Book ID'),
				categoryId: stringProperty('Optional category ID'),
				classId: stringProperty('Optional class ID'),
				name: stringProperty('Budget name'),
				periodEnd: stringProperty('Inclusive YYYY-MM-DD end date'),
				periodStart: stringProperty('Inclusive YYYY-MM-DD start date'),
				plannedMinor: integerProperty('Planned amount in minor units'),
			},
			['accountId', 'bookId', 'name', 'periodEnd', 'periodStart', 'plannedMinor']
		),
		name: 'create_budget',
	},
	{
		description: 'Get planned, actual, and remaining budget amounts.',
		inputSchema: objectSchema({ bookId: stringProperty('Book ID'), budgetId: stringProperty('Budget ID') }, [
			'bookId',
			'budgetId',
		]),
		name: 'get_budget_report',
	},
	{
		description: 'List scheduled payments in a book.',
		inputSchema: objectSchema({ bookId: stringProperty('Book ID') }, ['bookId']),
		name: 'list_schedules',
	},
	{
		description: 'Create a forecast schedule; this does not post a ledger transaction.',
		inputSchema: objectSchema(
			{
				accountId: stringProperty('Account ID'),
				amountMinor: integerProperty('Signed amount in minor units'),
				bookId: stringProperty('Book ID'),
				endDate: stringProperty('Optional inclusive YYYY-MM-DD end date'),
				frequency: {
					description: 'Recurrence frequency',
					enum: ['one_time', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
					type: 'string',
				},
				interval: integerProperty('Optional recurrence interval'),
				memo: stringProperty('Optional memo'),
				occurrenceLimit: integerProperty('Optional maximum occurrence count'),
				payee: stringProperty('Optional payee'),
				startDate: stringProperty('First YYYY-MM-DD due date'),
			},
			['accountId', 'amountMinor', 'bookId', 'frequency', 'startDate']
		),
		name: 'create_schedule',
	},
	{
		description: 'Update details of a scheduled payment without changing past occurrences.',
		inputSchema: objectSchema(
			{
				amountMinor: integerProperty('Optional signed minor units'),
				bookId: stringProperty('Book ID'),
				endDate: stringProperty('Optional YYYY-MM-DD end date'),
				memo: stringProperty('Optional memo'),
				occurrenceLimit: integerProperty('Optional maximum occurrence count'),
				payee: stringProperty('Optional payee'),
				scheduleId: stringProperty('Schedule ID'),
			},
			['bookId', 'scheduleId']
		),
		name: 'update_schedule',
	},
	{
		description: 'Pause, resume, or cancel a scheduled payment.',
		inputSchema: objectSchema(
			{
				bookId: stringProperty('Book ID'),
				scheduleId: stringProperty('Schedule ID'),
				status: {
					description: 'Target schedule status',
					enum: ['active', 'paused', 'canceled'],
					type: 'string',
				},
			},
			['bookId', 'scheduleId', 'status']
		),
		name: 'change_schedule_status',
	},
	{
		description: 'List persisted forecast occurrences for a scheduled payment.',
		inputSchema: objectSchema({ bookId: stringProperty('Book ID'), scheduleId: stringProperty('Schedule ID') }, [
			'bookId',
			'scheduleId',
		]),
		name: 'list_schedule_occurrences',
	},
	{
		description: 'Generate bounded forecast occurrences through an inclusive date; does not post transactions.',
		inputSchema: objectSchema(
			{
				bookId: stringProperty('Book ID'),
				maxOccurrences: integerProperty('Optional batch limit, maximum 500'),
				scheduleId: stringProperty('Schedule ID'),
				throughDate: stringProperty('Inclusive YYYY-MM-DD date'),
			},
			['bookId', 'scheduleId', 'throughDate']
		),
		name: 'generate_schedule_occurrences',
	},
	{
		description: 'Link an occurrence to an existing matching ledger transaction; does not create one.',
		inputSchema: objectSchema(
			{
				bookId: stringProperty('Book ID'),
				occurrenceId: stringProperty('Occurrence ID'),
				transactionId: stringProperty('Existing transaction ID'),
			},
			['bookId', 'occurrenceId', 'transactionId']
		),
		name: 'record_schedule_occurrence',
	},
	{
		description: 'List participants in a book, optionally including removed identities.',
		inputSchema: objectSchema(
			{ bookId: stringProperty('Book ID'), includeRemoved: booleanProperty('Include removed participants') },
			['bookId']
		),
		name: 'list_shared_expense_participants',
	},
	{
		description: 'Add a participant identity to a book.',
		inputSchema: objectSchema(
			{
				bookId: stringProperty('Book ID'),
				id: stringProperty('Stable participant ID'),
				name: stringProperty('Participant display name'),
			},
			['bookId', 'id', 'name']
		),
		name: 'create_shared_expense_participant',
	},
	{
		description: 'Soft-remove a participant while preserving historical allocations.',
		inputSchema: objectSchema(
			{ bookId: stringProperty('Book ID'), participantId: stringProperty('Participant ID') },
			['bookId', 'participantId']
		),
		name: 'remove_shared_expense_participant',
	},
	{
		description: 'List expenses and their allocations and settlements.',
		inputSchema: objectSchema(
			{ bookId: stringProperty('Book ID'), includeClosed: booleanProperty('Include closed expenses') },
			['bookId']
		),
		name: 'list_shared_expenses',
	},
	{
		description: 'Allocate a positive expense among active participants; actor attribution remains separate.',
		inputSchema: objectSchema(
			{
				amountMinor: integerProperty('Positive expense amount in minor units'),
				bookId: stringProperty('Book ID'),
				description: stringProperty('Expense description'),
				participantIds: { items: stringProperty('Participant ID'), type: 'array' },
			},
			['amountMinor', 'bookId', 'description', 'participantIds']
		),
		name: 'create_shared_expense',
	},
	{
		description: 'Close a shared expense to further settlements.',
		inputSchema: objectSchema({ bookId: stringProperty('Book ID'), expenseId: stringProperty('Expense ID') }, [
			'bookId',
			'expenseId',
		]),
		name: 'close_shared_expense',
	},
	{
		description: 'Reopen a closed shared expense.',
		inputSchema: objectSchema({ bookId: stringProperty('Book ID'), expenseId: stringProperty('Expense ID') }, [
			'bookId',
			'expenseId',
		]),
		name: 'reopen_shared_expense',
	},
	{
		description: 'Record explicit settlement by a participant, distinct from a ledger transfer.',
		inputSchema: objectSchema(
			{
				bookId: stringProperty('Book ID'),
				expenseId: stringProperty('Expense ID'),
				participantId: stringProperty('Participant ID'),
			},
			['bookId', 'expenseId', 'participantId']
		),
		name: 'settle_shared_expense',
	},
];

function objectSchema(properties: Record<string, unknown> = {}, required?: string[]) {
	return { properties, ...(required && { required }), type: 'object' as const };
}

function stringProperty(description: string) {
	return { description, type: 'string' };
}

function integerProperty(description: string) {
	return { description, type: 'integer' };
}

function booleanProperty(description: string) {
	return { description, type: 'boolean' };
}

function transactionPartsProperty() {
	return {
		description: 'Optional complete split of the transaction into exact minor-unit parts',
		items: {
			properties: {
				amountMinor: integerProperty('Signed minor units'),
				categoryId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
				classId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
				memo: stringProperty('Optional part memo'),
			},
			required: ['amountMinor'],
			type: 'object',
		},
		type: 'array',
	};
}

function jsonResponse(body: unknown, status = 200): Response {
	return Response.json(body, {
		headers: { 'Cache-Control': 'no-store', 'MCP-Protocol-Version': MCP_PROTOCOL_VERSION.CURRENT },
		status,
	});
}

function hasAcceptedMcpJson(request: Request): boolean {
	const accepted = new Set(
		(request.headers.get('accept') ?? '').split(',').map(value => value.split(';', 1)[0]?.trim().toLowerCase())
	);

	return accepted.has('application/json') && accepted.has('text/event-stream');
}

function hasValidOrigin(request: Request): boolean {
	const origin = request.headers.get('origin');
	if (origin === null) {
		return true;
	}
	try {
		return new URL(origin).origin === new URL(request.url).origin;
	} catch {
		return false;
	}
}

function rpcError(id: JsonRpcRequest['id'] | null, code: number, message: string): Response {
	return jsonResponse({ error: { code, message }, id: id ?? JSON_RPC_NULL, jsonrpc: '2.0' });
}

async function readLimitedJson(request: Request): Promise<unknown> {
	const body = request.body;
	if (body === null) {
		throw new SyntaxError('MCP request body is required');
	}
	const chunks: Uint8Array[] = [];
	let length = 0;
	for await (const value of body) {
		length += value.byteLength;
		if (length > MCP_MAX_BODY_BYTES) {
			throw new RangeError('MCP request body exceeds the 6 MiB limit');
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}

	return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonRpcRequest(value: Record<string, unknown>): value is JsonRpcRequest & Record<string, unknown> {
	return (
		value.jsonrpc === '2.0' &&
		typeof value.method === 'string' &&
		(!Object.hasOwn(value, 'id') || typeof value.id === 'string' || typeof value.id === 'number')
	);
}

function readStringArgument(arguments_: Record<string, unknown>, key: string): string {
	const value = arguments_[key];

	return typeof value === 'string' ? value : '';
}

function textResult(value: unknown): { content: { text: string; type: 'text' }[]; structuredContent: unknown } {
	return { content: [{ text: JSON.stringify(value), type: 'text' }], structuredContent: value };
}

function decodeImportContent(value: unknown, fieldName: string): Uint8Array {
	if (typeof value !== 'string' || !/^(?:[A-Za-z\d+/]{4})*(?:[A-Za-z\d+/]{2}==|[A-Za-z\d+/]{3}=)?$/u.test(value)) {
		throw new TypeError(`${fieldName} must be valid base64`);
	}
	const decoded = Buffer.from(value, 'base64');
	if (decoded.byteLength > DEFAULT_IMPORT_LIMITS.maxBytes || decoded.toString('base64') !== value) {
		throw new RangeError(`${fieldName} exceeds the 2 MiB limit or is not canonical base64`);
	}

	return new Uint8Array(decoded);
}

function getToolRequest(
	name: string,
	arguments_: Record<string, unknown>
): undefined | { body?: unknown; method: string; path: string } {
	const bookId = typeof arguments_.bookId === 'string' ? encodeURIComponent(arguments_.bookId) : '';
	switch (name) {
		case 'archive_category': {
			return {
				method: 'POST',
				path: `/api/v1/books/${bookId}/categories/${encodeURIComponent(readStringArgument(arguments_, 'classificationId'))}/archive`,
			};
		}
		case 'archive_class': {
			return {
				method: 'POST',
				path: `/api/v1/books/${bookId}/classes/${encodeURIComponent(readStringArgument(arguments_, 'classificationId'))}/archive`,
			};
		}
		case 'change_schedule_status': {
			return {
				body: { status: arguments_.status },
				method: 'PUT',
				path: `/api/v1/books/${bookId}/schedules/${encodeURIComponent(readStringArgument(arguments_, 'scheduleId'))}/status`,
			};
		}
		case 'close_account': {
			return {
				method: 'POST',
				path: `/api/v1/books/${bookId}/accounts/${encodeURIComponent(readStringArgument(arguments_, 'accountId'))}/close`,
			};
		}
		case 'close_shared_expense': {
			return {
				method: 'POST',
				path: `/api/v1/books/${bookId}/shared-expenses/${encodeURIComponent(readStringArgument(arguments_, 'expenseId'))}/close`,
			};
		}
		case 'create_account': {
			return { body: arguments_, method: 'POST', path: `/api/v1/books/${bookId}/accounts` };
		}
		case 'create_book': {
			return { body: arguments_, method: 'POST', path: '/api/v1/books' };
		}
		case 'create_budget': {
			return { body: arguments_, method: 'POST', path: `/api/v1/books/${bookId}/budgets` };
		}
		case 'create_category': {
			return {
				body: { name: arguments_.name, parentId: arguments_.parentId ?? JSON_RPC_NULL },
				method: 'POST',
				path: `/api/v1/books/${bookId}/categories`,
			};
		}
		case 'create_class': {
			return {
				body: { name: arguments_.name, parentId: arguments_.parentId ?? JSON_RPC_NULL },
				method: 'POST',
				path: `/api/v1/books/${bookId}/classes`,
			};
		}
		case 'create_schedule': {
			return { body: arguments_, method: 'POST', path: `/api/v1/books/${bookId}/schedules` };
		}
		case 'create_shared_expense': {
			return { body: arguments_, method: 'POST', path: `/api/v1/books/${bookId}/shared-expenses` };
		}
		case 'create_shared_expense_participant': {
			return {
				body: { id: arguments_.id, name: arguments_.name },
				method: 'POST',
				path: `/api/v1/books/${bookId}/shared-expense-participants`,
			};
		}
		case 'create_transaction': {
			return { body: arguments_, method: 'POST', path: `/api/v1/books/${bookId}/transactions` };
		}
		case 'create_transfer': {
			return { body: arguments_, method: 'POST', path: `/api/v1/books/${bookId}/transfers` };
		}
		case 'delete_transaction': {
			return {
				method: 'DELETE',
				path: `/api/v1/books/${bookId}/transactions/${encodeURIComponent(readStringArgument(arguments_, 'transactionId'))}`,
			};
		}
		case 'generate_schedule_occurrences': {
			return {
				body: {
					...(typeof arguments_.maxOccurrences === 'number' && { maxOccurrences: arguments_.maxOccurrences }),
					throughDate: arguments_.throughDate,
				},
				method: 'POST',
				path: `/api/v1/books/${bookId}/schedules/${encodeURIComponent(readStringArgument(arguments_, 'scheduleId'))}/occurrences`,
			};
		}
		case 'get_account_balances': {
			return {
				method: 'GET',
				path: `/api/v1/books/${bookId}/accounts/${encodeURIComponent(readStringArgument(arguments_, 'accountId'))}/balances${typeof arguments_.asOf === 'string' ? `?asOf=${encodeURIComponent(arguments_.asOf)}` : ''}`,
			};
		}
		case 'get_budget_report': {
			return {
				method: 'GET',
				path: `/api/v1/books/${bookId}/budgets/${encodeURIComponent(readStringArgument(arguments_, 'budgetId'))}/report`,
			};
		}
		case 'list_accounts': {
			return {
				method: 'GET',
				path: `/api/v1/books/${bookId}/accounts${arguments_.includeClosed === true ? '?includeClosed=true' : ''}`,
			};
		}
		case 'list_books': {
			return { method: 'GET', path: '/api/v1/books' };
		}
		case 'list_budgets': {
			return {
				method: 'GET',
				path: `/api/v1/books/${bookId}/budgets${typeof arguments_.accountId === 'string' ? `?accountId=${encodeURIComponent(arguments_.accountId)}` : ''}`,
			};
		}
		case 'list_categories': {
			return {
				method: 'GET',
				path: `/api/v1/books/${bookId}/categories${arguments_.includeArchived === true ? '?includeArchived=true' : ''}`,
			};
		}
		case 'list_classes': {
			return {
				method: 'GET',
				path: `/api/v1/books/${bookId}/classes${arguments_.includeArchived === true ? '?includeArchived=true' : ''}`,
			};
		}
		case 'list_schedule_occurrences': {
			return {
				method: 'GET',
				path: `/api/v1/books/${bookId}/schedules/${encodeURIComponent(readStringArgument(arguments_, 'scheduleId'))}/occurrences`,
			};
		}
		case 'list_schedules': {
			return { method: 'GET', path: `/api/v1/books/${bookId}/schedules` };
		}
		case 'list_shared_expense_participants': {
			return {
				method: 'GET',
				path: `/api/v1/books/${bookId}/shared-expense-participants${arguments_.includeRemoved === true ? '?includeRemoved=true' : ''}`,
			};
		}
		case 'list_shared_expenses': {
			return {
				method: 'GET',
				path: `/api/v1/books/${bookId}/shared-expenses${arguments_.includeClosed === true ? '?includeClosed=true' : ''}`,
			};
		}
		case 'list_transactions': {
			const query = new URLSearchParams({ accountId: readStringArgument(arguments_, 'accountId') });
			for (const key of ['fromDate', 'status', 'toDate'] as const) {
				if (typeof arguments_[key] === 'string') {
					query.set(key, arguments_[key]);
				}
			}

			return { method: 'GET', path: `/api/v1/books/${bookId}/transactions?${query.toString()}` };
		}
		case 'record_schedule_occurrence': {
			return {
				body: { transactionId: arguments_.transactionId },
				method: 'POST',
				path: `/api/v1/books/${bookId}/schedule-occurrences/${encodeURIComponent(readStringArgument(arguments_, 'occurrenceId'))}/record`,
			};
		}
		case 'remove_shared_expense_participant': {
			return {
				method: 'POST',
				path: `/api/v1/books/${bookId}/shared-expense-participants/${encodeURIComponent(readStringArgument(arguments_, 'participantId'))}/remove`,
			};
		}
		case 'reopen_account': {
			return {
				method: 'POST',
				path: `/api/v1/books/${bookId}/accounts/${encodeURIComponent(readStringArgument(arguments_, 'accountId'))}/open`,
			};
		}
		case 'reopen_shared_expense': {
			return {
				method: 'POST',
				path: `/api/v1/books/${bookId}/shared-expenses/${encodeURIComponent(readStringArgument(arguments_, 'expenseId'))}/reopen`,
			};
		}
		case 'restore_category': {
			return {
				method: 'POST',
				path: `/api/v1/books/${bookId}/categories/${encodeURIComponent(readStringArgument(arguments_, 'classificationId'))}/restore`,
			};
		}
		case 'restore_class': {
			return {
				method: 'POST',
				path: `/api/v1/books/${bookId}/classes/${encodeURIComponent(readStringArgument(arguments_, 'classificationId'))}/restore`,
			};
		}
		case 'set_transaction_status': {
			return {
				body: { status: arguments_.status },
				method: 'PUT',
				path: `/api/v1/books/${bookId}/transactions/${encodeURIComponent(readStringArgument(arguments_, 'transactionId'))}/status`,
			};
		}
		case 'settle_shared_expense': {
			return {
				body: { participantId: arguments_.participantId },
				method: 'POST',
				path: `/api/v1/books/${bookId}/shared-expenses/${encodeURIComponent(readStringArgument(arguments_, 'expenseId'))}/settle`,
			};
		}
		case 'update_category': {
			return {
				body: {
					...(typeof arguments_.name === 'string' && { name: arguments_.name }),
					...('parentId' in arguments_ && { parentId: arguments_.parentId }),
				},
				method: 'PATCH',
				path: `/api/v1/books/${bookId}/categories/${encodeURIComponent(readStringArgument(arguments_, 'classificationId'))}`,
			};
		}
		case 'update_class': {
			return {
				body: {
					...(typeof arguments_.name === 'string' && { name: arguments_.name }),
					...('parentId' in arguments_ && { parentId: arguments_.parentId }),
				},
				method: 'PATCH',
				path: `/api/v1/books/${bookId}/classes/${encodeURIComponent(readStringArgument(arguments_, 'classificationId'))}`,
			};
		}
		case 'update_schedule': {
			return {
				body: {
					...(typeof arguments_.amountMinor === 'number' && { amountMinor: arguments_.amountMinor }),
					...(typeof arguments_.endDate === 'string' && { endDate: arguments_.endDate }),
					...(typeof arguments_.memo === 'string' && { memo: arguments_.memo }),
					...(typeof arguments_.occurrenceLimit === 'number' && {
						occurrenceLimit: arguments_.occurrenceLimit,
					}),
					...(typeof arguments_.payee === 'string' && { payee: arguments_.payee }),
				},
				method: 'PATCH',
				path: `/api/v1/books/${bookId}/schedules/${encodeURIComponent(readStringArgument(arguments_, 'scheduleId'))}`,
			};
		}
		case 'update_transaction': {
			return {
				body: {
					...(typeof arguments_.accountId === 'string' && { accountId: arguments_.accountId }),
					...(typeof arguments_.amountMinor === 'number' && { amountMinor: arguments_.amountMinor }),
					...(typeof arguments_.memo === 'string' && { memo: arguments_.memo }),
					...(Array.isArray(arguments_.parts) && { parts: arguments_.parts }),
					...(typeof arguments_.payee === 'string' && { payee: arguments_.payee }),
					...(typeof arguments_.transactionDate === 'string' && {
						transactionDate: arguments_.transactionDate,
					}),
				},
				method: 'PATCH',
				path: `/api/v1/books/${bookId}/transactions/${encodeURIComponent(readStringArgument(arguments_, 'transactionId'))}`,
			};
		}
		default: {
			return undefined;
		}
	}
}

async function invokeTool(
	name: string,
	arguments_: Record<string, unknown>,
	actor: { id: string; kind: 'home_assistant_integration' | 'home_assistant_user' },
	useCases: FinanceUseCases
) {
	const actorId = actor.id;
	if (name === 'preview_statement_import' || name === 'commit_statement_import') {
		try {
			const format = arguments_.format;
			if (typeof format !== 'string' || !(IMPORT_FORMATS as readonly string[]).includes(format)) {
				throw new TypeError('format is invalid');
			}
			const input = {
				accountId: typeof arguments_.accountId === 'string' ? arguments_.accountId : '',
				actorId,
				bookId: typeof arguments_.bookId === 'string' ? arguments_.bookId : '',
				content: decodeImportContent(arguments_.contentBase64, 'contentBase64'),
				format: format as ImportFormat,
				...(arguments_.payeeDirectoryBase64 !== undefined && {
					payeeDirectory: decodeImportContent(arguments_.payeeDirectoryBase64, 'payeeDirectoryBase64'),
				}),
			};
			const value =
				name === 'preview_statement_import'
					? useCases.imports.preview.execute(input)
					: useCases.imports.commit.execute(input);

			return { isError: false, ...textResult(value) };
		} catch (error) {
			const message =
				error instanceof ImportError || error instanceof TypeError || error instanceof RangeError
					? error.message
					: 'The import could not be completed';

			return { isError: true, ...textResult({ error: message }) };
		}
	}

	const toolRequest = getToolRequest(name, arguments_);
	if (!toolRequest) {
		return;
	}
	const response = await handleFinanceRequest(
		new Request(`http://fin-assist${toolRequest.path}`, {
			method: toolRequest.method,
			...(toolRequest.body !== undefined && {
				body: JSON.stringify(toolRequest.body),
				headers: { 'Content-Type': 'application/json' },
			}),
		}),
		actor,
		useCases
	);
	const value = response.status === 204 ? { status: 'ok' } : (JSON.parse(await response.text()) as unknown);

	return { isError: !response.ok, ...textResult(value) };
}

async function processRpc(
	message: JsonRpcRequest,
	protocolVersion: string,
	actor: { id: string; kind: 'home_assistant_integration' | 'home_assistant_user' },
	useCases: FinanceUseCases
): Promise<Response> {
	if (message.id === undefined && message.method.startsWith('notifications/')) {
		return new Response(JSON_RPC_NULL, {
			headers: { 'Cache-Control': 'no-store', 'MCP-Protocol-Version': MCP_PROTOCOL_VERSION.CURRENT },
			status: 202,
		});
	}
	if (message.method === 'ping') {
		return jsonResponse({ id: message.id ?? JSON_RPC_NULL, jsonrpc: '2.0', result: {} });
	}
	if (message.method === 'initialize') {
		const parameters = isRecord(message.params) ? message.params : {};
		const requested = parameters.protocolVersion;
		if (typeof requested !== 'string') {
			return rpcError(message.id ?? JSON_RPC_NULL, -32_602, 'protocolVersion is required');
		}

		return jsonResponse({
			id: message.id ?? JSON_RPC_NULL,
			jsonrpc: '2.0',
			result: {
				capabilities: { tools: { listChanged: false } },
				protocolVersion: MCP_PROTOCOL_VERSION.CURRENT,
				serverInfo: MCP_SERVER_INFO,
			},
		});
	}
	if (message.method === 'tools/list') {
		return jsonResponse({ id: message.id ?? JSON_RPC_NULL, jsonrpc: '2.0', result: { tools: TOOLS } });
	}
	if (message.method === 'tools/call') {
		const parameters = isRecord(message.params) ? message.params : {};
		const toolArguments = parameters.arguments ?? {};
		if (typeof parameters.name !== 'string' || !isRecord(toolArguments)) {
			return rpcError(message.id ?? JSON_RPC_NULL, -32_602, 'A tool name and object arguments are required');
		}
		const result = await invokeTool(parameters.name, toolArguments, actor, useCases);

		return result === undefined
			? rpcError(message.id ?? JSON_RPC_NULL, -32_602, `Unknown tool: ${parameters.name}`)
			: jsonResponse({ id: message.id ?? JSON_RPC_NULL, jsonrpc: '2.0', result });
	}
	void protocolVersion;

	return rpcError(message.id ?? JSON_RPC_NULL, -32_601, `Method not found: ${message.method}`);
}

async function handleMcpRequest(
	request: Request,
	tokenUseCases: TokenManagementUseCases,
	useCases: FinanceUseCases,
	systemCredentialUseCases?: SystemCredentialUseCases
): Promise<Response> {
	if (!hasValidOrigin(request)) {
		return new Response('Forbidden', { status: 403 });
	}
	if (request.method !== 'POST') {
		return new Response('Method Not Allowed', { headers: { Allow: 'POST' }, status: 405 });
	}
	if (!hasAcceptedMcpJson(request)) {
		return new Response('Not Acceptable', { status: 406 });
	}
	const authorizationParts = (request.headers.get('authorization') ?? '').trim().split(/\s+/u, 3);
	const [scheme = '', secret = ''] = authorizationParts;
	if (!secret || authorizationParts.length !== 2 || scheme.toLowerCase() !== 'bearer') {
		return jsonResponse({ error: 'Authentication required' }, 401);
	}
	let actor: undefined | { id: string; kind: 'home_assistant_integration' | 'home_assistant_user' };
	if (systemCredentialUseCases !== undefined) {
		const credential = await systemCredentialUseCases.authenticate.execute(secret);
		if (credential) {
			actor = { id: credential.id, kind: 'home_assistant_integration' };
		}
	}
	if (actor === undefined) {
		const token = await tokenUseCases.authenticate.execute(secret);
		if (!token) {
			return jsonResponse({ error: 'Authentication required' }, 401);
		}
		actor = { id: token.ownerId, kind: 'home_assistant_user' };
	}
	if ((request.headers.get('content-type') ?? '').split(';', 1).join('').trim() !== 'application/json') {
		return new Response('Unsupported Media Type', { status: 415 });
	}

	let message: unknown;
	try {
		message = await readLimitedJson(request);
	} catch (error) {
		if (error instanceof RangeError) {
			return jsonResponse({ error: error.message }, 413);
		}

		return rpcError(JSON_RPC_NULL, -32_700, 'Parse error');
	}
	if (Array.isArray(message)) {
		return rpcError(JSON_RPC_NULL, -32_600, 'Batch requests are not supported');
	}
	if (!isRecord(message) || !isJsonRpcRequest(message)) {
		return rpcError(JSON_RPC_NULL, -32_600, 'Invalid Request');
	}
	const rpcRequest = message;
	if (!Object.hasOwn(message, 'id') && !rpcRequest.method.startsWith('notifications/')) {
		return rpcError(JSON_RPC_NULL, -32_600, 'Requests must include an id');
	}
	const protocolVersion = request.headers.get('mcp-protocol-version') ?? MCP_PROTOCOL_VERSION.CURRENT;
	if (protocolVersion !== MCP_PROTOCOL_VERSION.CURRENT) {
		return rpcError(rpcRequest.id ?? JSON_RPC_NULL, -32_600, 'Unsupported MCP protocol version');
	}
	try {
		return await processRpc(rpcRequest, protocolVersion, actor, useCases);
	} catch {
		return rpcError(rpcRequest.id ?? JSON_RPC_NULL, -32_603, 'Internal error');
	}
}

export { handleMcpRequest, MCP_MAX_BODY_BYTES, MCP_PROTOCOL_VERSION, TOOLS };
