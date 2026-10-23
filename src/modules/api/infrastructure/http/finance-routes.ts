import { randomUUID } from 'node:crypto';

import type {
	CloseAccount,
	CreateAccount,
	GetAccountBalances,
	ListAccounts,
	ReopenAccount,
} from '@modules/accounts/application';
import type { ArchiveBook, CreateBook, DeleteBook, ListBooks } from '@modules/books/application';
import type { CreateBudget, GetBudgetReport, ListBudgets } from '@modules/budgets/application';
import type {
	ArchiveClassification,
	CreateClassification,
	DeleteClassification,
	ListClassifications,
	RestoreClassification,
	UpdateClassification,
} from '@modules/classifications/application';
import type { ClassificationKind } from '@modules/classifications/domain';
import type { CommitStatementImport, PreviewStatementImport } from '@modules/imports/application';
import type { ImportFormat } from '@modules/imports/domain';
import { DEFAULT_IMPORT_LIMITS, IMPORT_FORMATS, ImportError } from '@modules/imports/domain';
import type {
	CreateTransaction,
	CreateTransfer,
	DeleteTransaction,
	ListTransactions,
	SetTransactionStatus,
	UpdateTransaction,
} from '@modules/ledger/application';
import type {
	ChangeScheduleStatus,
	CreateSchedule,
	GenerateScheduleOccurrences,
	ListScheduleOccurrences,
	ListSchedules,
	RecordScheduleOccurrence,
	UpdateSchedule,
} from '@modules/schedules/application';
import type { CreateScheduledPaymentInput } from '@modules/schedules/domain';
import { SCHEDULE_FREQUENCY } from '@modules/schedules/domain';
import type {
	CloseSharedExpense,
	CreateSharedExpense,
	CreateSharedExpenseParticipant,
	ListSharedExpenseParticipants,
	ListSharedExpenses,
	RemoveSharedExpenseParticipant,
	ReopenSharedExpense,
	SettleSharedExpense,
} from '@modules/shared-expenses/application';

interface FinanceUseCases {
	accounts: {
		balances: GetAccountBalances;
		close: CloseAccount;
		create: CreateAccount;
		list: ListAccounts;
		open: ReopenAccount;
	};
	books: { archive: ArchiveBook; create: CreateBook; delete: DeleteBook; list: ListBooks };
	budgets: { create: CreateBudget; getReport: GetBudgetReport; list: ListBudgets };
	classifications: {
		archive: Record<ClassificationKind, ArchiveClassification>;
		create: Record<ClassificationKind, CreateClassification>;
		delete: Record<ClassificationKind, DeleteClassification>;
		list: Record<ClassificationKind, ListClassifications>;
		restore: Record<ClassificationKind, RestoreClassification>;
		update: Record<ClassificationKind, UpdateClassification>;
	};
	imports: { commit: CommitStatementImport; preview: PreviewStatementImport };
	ledger: {
		create: CreateTransaction;
		createTransfer: CreateTransfer;
		delete: DeleteTransaction;
		list: ListTransactions;
		setStatus: SetTransactionStatus;
		update: UpdateTransaction;
	};
	schedules: {
		changeStatus: ChangeScheduleStatus;
		create: CreateSchedule;
		generateOccurrences: GenerateScheduleOccurrences;
		list: ListSchedules;
		listOccurrences: ListScheduleOccurrences;
		recordOccurrence: RecordScheduleOccurrence;
		update: UpdateSchedule;
	};
	sharedExpenses: {
		close: CloseSharedExpense;
		create: CreateSharedExpense;
		createParticipant: CreateSharedExpenseParticipant;
		list: ListSharedExpenses;
		listParticipants: ListSharedExpenseParticipants;
		removeParticipant: RemoveSharedExpenseParticipant;
		reopen: ReopenSharedExpense;
		settle: SettleSharedExpense;
	};
}

interface RouteActor {
	id: string;
	kind?: 'home_assistant_integration' | 'home_assistant_user';
}

class RequestTooLargeError extends Error {}

const JSON_NULL = JSON.parse('null') as null;

function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}): Response {
	return Response.json(body, {
		headers: { 'Cache-Control': 'no-store', ...Object.fromEntries(new Headers(headers)) },
		status,
	});
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== JSON_NULL && !Array.isArray(value);
}

function readString(value: unknown, name: string): string {
	if (typeof value !== 'string' || value.trim() === '') {
		throw new TypeError(`${name} must be a non-empty string`);
	}

	return value;
}

function readMinor(value: unknown): number {
	if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
		throw new TypeError('amountMinor must be a safe integer');
	}

	return value;
}

function readStringArray(value: unknown, name: string): string[] {
	if (!Array.isArray(value)) {
		throw new TypeError(`${name} must be an array of strings`);
	}

	return value.map((item: unknown) => {
		if (typeof item !== 'string') {
			throw new TypeError(`${name} must be an array of strings`);
		}

		return item;
	});
}

function readOccurrenceLimit(value: unknown): number | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (typeof value !== 'number' && typeof value !== 'string') {
		throw new TypeError('maxOccurrences must be a non-negative integer');
	}

	return readPageParameter(value.toString(), 100, 'maxOccurrences', 500);
}

function assertDateParameter(name: string, value: null | string): void {
	if (value !== JSON_NULL && !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
		throw new TypeError(`${name} must use YYYY-MM-DD`);
	}
}

function assertTransactionStatus(status: null | string): void {
	if (status !== JSON_NULL && status !== 'uncleared' && status !== 'cleared' && status !== 'reconciled') {
		throw new TypeError('status is invalid');
	}
}

function readParts(value: unknown) {
	if (value === undefined) {
		return;
	}
	if (!Array.isArray(value)) {
		throw new TypeError('parts must be an array');
	}

	return value.map((part: unknown) => {
		if (!isRecord(part)) {
			throw new TypeError('Each transaction part must be an object');
		}

		return {
			amountMinor: readMinor(part.amountMinor),
			categoryId:
				typeof part.categoryId === 'string' || part.categoryId === JSON_NULL ? part.categoryId : undefined,
			classId: typeof part.classId === 'string' || part.classId === JSON_NULL ? part.classId : undefined,
			memo: typeof part.memo === 'string' ? part.memo : undefined,
		};
	});
}

function readPageParameter(value: null | string, fallback: number, name: string, maximum: number): number {
	if (value === JSON_NULL) {
		return fallback;
	}
	if (!/^\d+$/u.test(value)) {
		throw new TypeError(`${name} must be a non-negative integer`);
	}
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed > maximum) {
		throw new TypeError(`${name} cannot exceed ${maximum.toString()}`);
	}

	return parsed;
}

function paginated<T>(items: T[], url: URL) {
	const limit = readPageParameter(url.searchParams.get('limit'), 100, 'limit', 100);
	if (limit === 0) {
		throw new TypeError('limit must be greater than zero');
	}
	const offset = readPageParameter(url.searchParams.get('offset'), 0, 'offset', Number.MAX_SAFE_INTEGER);

	return { items: items.slice(offset, offset + limit), limit, offset, total: items.length };
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw new TypeError('Invalid JSON body');
	}
	if (!isRecord(body)) {
		throw new TypeError('Request body must be a JSON object');
	}

	return body;
}

async function readImportRequest(request: Request, bookId: string, actorId: string) {
	const maxRequestBytes = DEFAULT_IMPORT_LIMITS.maxBytes * 2 + 64 * 1024;
	const contentLengthHeader = request.headers.get('content-length');
	if (contentLengthHeader !== JSON_NULL && Number(contentLengthHeader) > maxRequestBytes) {
		throw new RequestTooLargeError('The uploaded request exceeds the size limit.');
	}
	const contentType = request.headers.get('content-type');
	if (contentType?.split(';', 1)[0]?.trim() !== 'multipart/form-data') {
		throw new TypeError('Content-Type must be multipart/form-data');
	}

	const form = await request.formData();
	const accountId = readString(form.get('accountId'), 'accountId');
	const format = readString(form.get('format'), 'format');
	if (!(IMPORT_FORMATS as readonly string[]).includes(format)) {
		throw new TypeError('format must be qif, payee_csv, or statement_csv');
	}
	const content = form.get('file');
	if (!(content instanceof File)) {
		throw new TypeError('file must be an uploaded file');
	}
	if (content.size > DEFAULT_IMPORT_LIMITS.maxBytes) {
		throw new RequestTooLargeError('The uploaded file exceeds the 2 MiB limit.');
	}
	const payeeDirectory = form.get('payeeDirectory');
	if (payeeDirectory !== JSON_NULL && !(payeeDirectory instanceof File)) {
		throw new TypeError('payeeDirectory must be an uploaded file');
	}
	if (payeeDirectory instanceof File && payeeDirectory.size > DEFAULT_IMPORT_LIMITS.maxBytes) {
		throw new RequestTooLargeError('The payee directory exceeds the 2 MiB limit.');
	}

	return {
		accountId,
		actorId,
		bookId,
		content: new Uint8Array(await content.arrayBuffer()),
		format: format as ImportFormat,
		...(payeeDirectory instanceof File && { payeeDirectory: new Uint8Array(await payeeDirectory.arrayBuffer()) }),
	};
}

function routeError(error: unknown): Response {
	if (error instanceof RequestTooLargeError) {
		return jsonResponse({ error: error.message }, 413);
	}
	if (error instanceof ImportError) {
		const status = error.code.endsWith('-not-found')
			? 404
			: error.code === 'possible-duplicate'
				? 409
				: error.code === 'file-too-large'
					? 413
					: 400;

		return jsonResponse(
			{ action: error.action, code: error.code, error: error.message, issues: error.issues },
			status
		);
	}
	if (error instanceof TypeError || error instanceof RangeError) {
		return jsonResponse({ error: error.message }, 400);
	}
	if (error instanceof Error) {
		if (error.name === 'SQLiteError') {
			return jsonResponse({ error: 'The request could not be completed' }, 500);
		}
		const message = error.message;
		if (/not found|does not exist/iu.test(message)) {
			return jsonResponse({ error: message }, 404);
		}
		if (/already exists|cannot|is used|has child|status transition is not allowed/iu.test(message)) {
			return jsonResponse({ error: message }, 409);
		}

		return jsonResponse({ error: message }, 400);
	}

	return jsonResponse({ error: 'The request could not be completed' }, 500);
}

function allowedMethods(segments: string[]): string[] | undefined {
	const [resource, id, subresource, childId, action] = segments;
	if (resource !== 'books') {
		return undefined;
	}
	if (segments.length === 1) {
		return ['GET', 'POST'];
	}
	if (!id) {
		return undefined;
	}
	if (segments.length === 2) {
		return ['DELETE'];
	}
	if (segments.length === 3) {
		if (subresource === 'archive' || subresource === 'transfers') {
			return ['POST'];
		}
		if (
			[
				'accounts',
				'budgets',
				'categories',
				'classes',
				'schedules',
				'shared-expense-participants',
				'shared-expenses',
				'transactions',
			].includes(subresource)
		) {
			return ['GET', 'POST'];
		}

		return undefined;
	}
	if (segments.length === 4) {
		if (subresource === 'imports' && (childId === 'preview' || childId === 'commit')) {
			return ['POST'];
		}
		if (subresource === 'categories' || subresource === 'classes') {
			return ['PATCH', 'DELETE'];
		}
		if (subresource === 'transactions' && childId !== 'transfers') {
			return ['PATCH', 'DELETE'];
		}
		if (subresource === 'schedules' && id) {
			return ['PATCH'];
		}

		return undefined;
	}
	if (segments.length === 5) {
		if (subresource === 'accounts' && action === 'balances') {
			return ['GET'];
		}
		if (subresource === 'accounts' && (action === 'open' || action === 'close')) {
			return ['POST'];
		}
		if (
			(subresource === 'categories' || subresource === 'classes') &&
			(action === 'archive' || action === 'restore')
		) {
			return ['POST'];
		}
		if (subresource === 'transactions' && action === 'status') {
			return ['PUT'];
		}
		if (subresource === 'budgets' && action === 'report') {
			return ['GET'];
		}
		if (subresource === 'schedules' && action === 'status') {
			return ['PUT'];
		}
		if (subresource === 'schedules' && action === 'occurrences') {
			return ['GET', 'POST'];
		}
		if (subresource === 'shared-expenses' && (action === 'close' || action === 'reopen' || action === 'settle')) {
			return ['POST'];
		}
		if (subresource === 'shared-expense-participants' && action === 'remove') {
			return ['POST'];
		}
		if (subresource === 'schedule-occurrences' && action === 'record') {
			return ['POST'];
		}
	}

	return undefined;
}

async function handleFinanceRequest(request: Request, actor: RouteActor, useCases: FinanceUseCases): Promise<Response> {
	const url = new URL(request.url);
	const apiIndex = url.pathname.indexOf('/api/v1');

	try {
		const segments = url.pathname
			.slice(apiIndex + '/api/v1'.length)
			.split('/')
			.filter(Boolean)
			.map(segment => decodeURIComponent(segment));
		const [resource, id, subresource, childId, action] = segments;
		const method = request.method;
		const allowed = allowedMethods(segments);
		if (allowed && !allowed.includes(method)) {
			return jsonResponse({ error: 'Method not allowed' }, 405, { Allow: allowed.join(', ') });
		}

		if (resource === 'books') {
			if (method === 'GET' && segments.length === 1) {
				return jsonResponse(paginated(useCases.books.list.execute(), url));
			}
			if (method === 'POST' && segments.length === 1) {
				const body = await readJson(request);
				const book = useCases.books.create.execute({
					currencyCode: readString(body.currencyCode, 'currencyCode'),
					name: readString(body.name, 'name'),
				});

				return jsonResponse(book, 201);
			}
			if (method === 'POST' && id && subresource === 'archive' && segments.length === 3) {
				return useCases.books.archive.execute(id)
					? new Response(JSON_NULL, { status: 204 })
					: jsonResponse({ error: 'Book not found' }, 404);
			}
			if (method === 'DELETE' && id && segments.length === 2) {
				return useCases.books.delete.execute(id)
					? new Response(JSON_NULL, { status: 204 })
					: jsonResponse({ error: 'Book is not empty or does not exist' }, 409);
			}
		}

		if (resource === 'books' && subresource === 'accounts' && id) {
			if (method === 'GET' && segments.length === 3) {
				const isIncludeClosed = url.searchParams.get('includeClosed') === 'true';
				const accounts = useCases.accounts.list.execute({ bookId: id, includeClosed: isIncludeClosed });

				return jsonResponse(paginated(accounts, url));
			}
			if (method === 'POST' && segments.length === 3) {
				const body = await readJson(request);

				return jsonResponse(
					useCases.accounts.create.execute({
						bookId: id,
						kind: readString(body.kind, 'kind'),
						name: readString(body.name, 'name'),
						openingBalanceMinor: readMinor(body.openingBalanceMinor),
					}),
					201
				);
			}
			if (method === 'GET' && childId && segments.length === 5) {
				const balances = useCases.accounts.balances.execute({
					asOf: url.searchParams.get('asOf') ?? undefined,
					bookId: id,
					id: childId,
				});

				return jsonResponse({
					postedMinor: balances.posted.minorUnits,
					reconciledMinor: balances.reconciled.minorUnits,
					totalMinor: balances.total.minorUnits,
				});
			}
			if (
				method === 'POST' &&
				childId &&
				segments.length === 5 &&
				(segments[4] === 'open' || segments[4] === 'close')
			) {
				const isSucceeded =
					segments[4] === 'close'
						? useCases.accounts.close.execute(id, childId)
						: useCases.accounts.open.execute(id, childId);

				return isSucceeded
					? new Response(JSON_NULL, { status: 204 })
					: jsonResponse({ error: 'Account not found or state unchanged' }, 404);
			}
		}

		if (resource === 'books' && id && (subresource === 'categories' || subresource === 'classes')) {
			const kind: ClassificationKind = subresource === 'categories' ? 'category' : 'class';
			const operations = {
				archive: useCases.classifications.archive[kind],
				create: useCases.classifications.create[kind],
				delete: useCases.classifications.delete[kind],
				list: useCases.classifications.list[kind],
				restore: useCases.classifications.restore[kind],
				update: useCases.classifications.update[kind],
			};
			if (method === 'GET' && segments.length === 3) {
				const isIncludeArchived = url.searchParams.get('includeArchived') === 'true';
				const classifications = operations.list.execute(id, { includeArchived: isIncludeArchived });

				return jsonResponse(paginated(classifications, url));
			}
			if (method === 'POST' && segments.length === 3) {
				const body = await readJson(request);

				return jsonResponse(
					operations.create.execute({
						bookId: id,
						name: readString(body.name, 'name'),
						parentId:
							body.parentId === JSON_NULL
								? JSON_NULL
								: typeof body.parentId === 'string'
									? body.parentId
									: undefined,
					}),
					201
				);
			}
			if (method === 'PATCH' && childId && segments.length === 4) {
				const body = await readJson(request);
				const input = {
					...(typeof body.name === 'string' && { name: body.name }),
					...('parentId' in body &&
						(body.parentId === JSON_NULL || typeof body.parentId === 'string') && {
							parentId: body.parentId,
						}),
				};

				return jsonResponse(operations.update.execute(id, childId, input));
			}
			if (method === 'POST' && childId && segments.length === 5 && segments[4] === 'archive') {
				return jsonResponse(operations.archive.execute(id, childId));
			}
			if (method === 'POST' && childId && segments.length === 5 && segments[4] === 'restore') {
				return jsonResponse(operations.restore.execute(id, childId));
			}
			if (method === 'DELETE' && childId && segments.length === 4) {
				operations.delete.execute(id, childId);

				return new Response(JSON_NULL, { status: 204 });
			}
		}

		if (resource === 'books' && subresource === 'budgets' && id) {
			if (method === 'GET' && segments.length === 3) {
				const accountId = url.searchParams.get('accountId');

				return jsonResponse(
					paginated(
						useCases.budgets.list.execute({ bookId: id, ...(accountId !== JSON_NULL && { accountId }) }),
						url
					)
				);
			}
			if (method === 'POST' && segments.length === 3) {
				const body = await readJson(request);

				return jsonResponse(
					useCases.budgets.create.execute({
						accountId: readString(body.accountId, 'accountId'),
						bookId: id,
						categoryId:
							body.categoryId === JSON_NULL
								? JSON_NULL
								: typeof body.categoryId === 'string'
									? body.categoryId
									: undefined,
						classId:
							body.classId === JSON_NULL
								? JSON_NULL
								: typeof body.classId === 'string'
									? body.classId
									: undefined,
						name: readString(body.name, 'name'),
						periodEnd: readString(body.periodEnd, 'periodEnd'),
						periodStart: readString(body.periodStart, 'periodStart'),
						plannedMinor: readMinor(body.plannedMinor),
					}),
					201
				);
			}
			if (method === 'GET' && childId && action === 'report' && segments.length === 5) {
				return jsonResponse(useCases.budgets.getReport.execute({ bookId: id, id: childId }));
			}
		}

		if (resource === 'books' && subresource === 'schedules' && id) {
			if (method === 'GET' && segments.length === 3) {
				return jsonResponse(paginated(useCases.schedules.list.execute(id), url));
			}
			if (method === 'POST' && segments.length === 3) {
				const body = await readJson(request);
				const frequency = readString(body.frequency, 'frequency');
				if (!(Object.values(SCHEDULE_FREQUENCY) as string[]).includes(frequency)) {
					throw new TypeError('frequency is invalid');
				}
				const scheduleInput: CreateScheduledPaymentInput = {
					accountId: readString(body.accountId, 'accountId'),
					amountMinor: readMinor(body.amountMinor),
					bookId: id,
					frequency: frequency as CreateScheduledPaymentInput['frequency'],
					id: randomUUID(),
					startDate: readString(body.startDate, 'startDate'),
					...(typeof body.endDate === 'string' && { endDate: body.endDate }),
					...(typeof body.interval === 'number' && { interval: body.interval }),
					...(typeof body.memo === 'string' && { memo: body.memo }),
					...(typeof body.occurrenceLimit === 'number' && { occurrenceLimit: body.occurrenceLimit }),
					...(typeof body.payee === 'string' && { payee: body.payee }),
				};

				return jsonResponse(useCases.schedules.create.execute(scheduleInput), 201);
			}
			if (method === 'PATCH' && childId && segments.length === 4) {
				const body = await readJson(request);

				return jsonResponse(
					useCases.schedules.update.execute(id, childId, {
						...(body.amountMinor !== undefined && { amountMinor: readMinor(body.amountMinor) }),
						...(typeof body.endDate === 'string' && { endDate: body.endDate }),
						...(typeof body.memo === 'string' && { memo: body.memo }),
						...(typeof body.occurrenceLimit === 'number' && { occurrenceLimit: body.occurrenceLimit }),
						...(typeof body.payee === 'string' && { payee: body.payee }),
					})
				);
			}
			if (method === 'PUT' && childId && action === 'status' && segments.length === 5) {
				const body = await readJson(request);
				if (body.status !== 'active' && body.status !== 'canceled' && body.status !== 'paused') {
					throw new TypeError('status is invalid');
				}

				return jsonResponse(useCases.schedules.changeStatus.execute(id, childId, body.status));
			}
			if (method === 'GET' && childId && action === 'occurrences' && segments.length === 5) {
				return jsonResponse(paginated(useCases.schedules.listOccurrences.execute(id, childId), url));
			}
			if (method === 'POST' && childId && action === 'occurrences' && segments.length === 5) {
				const body = await readJson(request);
				const throughDate = readString(body.throughDate, 'throughDate');
				const maxOccurrences = readOccurrenceLimit(body.maxOccurrences);
				if (maxOccurrences === 0) {
					throw new TypeError('maxOccurrences must be greater than zero');
				}

				return jsonResponse(
					useCases.schedules.generateOccurrences.execute(id, childId, throughDate, maxOccurrences)
				);
			}
		}

		if (
			resource === 'books' &&
			method === 'POST' &&
			id &&
			childId &&
			action === 'record' &&
			subresource === 'schedule-occurrences' &&
			segments.length === 5
		) {
			const body = await readJson(request);

			return jsonResponse(
				useCases.schedules.recordOccurrence.execute(
					id,
					childId,
					readString(body.transactionId, 'transactionId')
				)
			);
		}

		if (resource === 'books' && subresource === 'shared-expense-participants' && id) {
			if (method === 'GET' && segments.length === 3) {
				const isIncludeRemoved = url.searchParams.get('includeRemoved') === 'true';
				const participants = useCases.sharedExpenses.listParticipants.execute({
					bookId: id,
					includeRemoved: isIncludeRemoved,
				});

				return jsonResponse(paginated(participants, url));
			}
			if (method === 'POST' && segments.length === 3) {
				const body = await readJson(request);

				return jsonResponse(
					useCases.sharedExpenses.createParticipant.execute({
						bookId: id,
						id: readString(body.id, 'id'),
						name: readString(body.name, 'name'),
					}),
					201
				);
			}
			if (method === 'POST' && childId && action === 'remove' && segments.length === 5) {
				return useCases.sharedExpenses.removeParticipant.execute(id, childId)
					? new Response(JSON_NULL, { status: 204 })
					: jsonResponse({ error: 'Participant not found or still referenced' }, 404);
			}
		}

		if (resource === 'books' && subresource === 'shared-expenses' && id) {
			if (method === 'GET' && segments.length === 3) {
				const isIncludeClosed = url.searchParams.get('includeClosed') === 'true';
				const expenses = useCases.sharedExpenses.list.execute({ bookId: id, includeClosed: isIncludeClosed });

				return jsonResponse(paginated(expenses, url));
			}
			if (method === 'POST' && segments.length === 3) {
				const body = await readJson(request);

				return jsonResponse(
					useCases.sharedExpenses.create.execute({
						actor: { id: actor.id, kind: actor.kind ?? 'home_assistant_user' },
						amountMinor: readMinor(body.amountMinor),
						bookId: id,
						description: readString(body.description, 'description'),
						participantIds: readStringArray(body.participantIds, 'participantIds'),
					}),
					201
				);
			}
			if (method === 'POST' && childId && (action === 'close' || action === 'reopen') && segments.length === 5) {
				const isChanged =
					action === 'close'
						? useCases.sharedExpenses.close.execute(id, childId)
						: useCases.sharedExpenses.reopen.execute(id, childId);

				return isChanged
					? new Response(JSON_NULL, { status: 204 })
					: jsonResponse({ error: 'Shared expense not found or state unchanged' }, 404);
			}
			if (method === 'POST' && childId && action === 'settle' && segments.length === 5) {
				const body = await readJson(request);
				const isSettled = useCases.sharedExpenses.settle.execute({
					actor: { id: actor.id, kind: actor.kind ?? 'home_assistant_user' },
					bookId: id,
					expenseId: childId,
					participantId: readString(body.participantId, 'participantId'),
				});

				return isSettled
					? new Response(JSON_NULL, { status: 204 })
					: jsonResponse({ error: 'Settlement not found or expense is closed' }, 409);
			}
		}

		if (resource === 'books' && subresource === 'transactions' && id) {
			if (method === 'GET' && segments.length === 3) {
				const accountId = readString(url.searchParams.get('accountId'), 'accountId');
				const fromDate = url.searchParams.get('fromDate');
				const toDate = url.searchParams.get('toDate');
				const status = url.searchParams.get('status');
				assertDateParameter('fromDate', fromDate);
				assertDateParameter('toDate', toDate);
				assertTransactionStatus(status);
				const transactions = useCases.ledger.list
					.execute(id, accountId)
					.filter(
						transaction =>
							(fromDate === JSON_NULL || transaction.transactionDate >= fromDate) &&
							(toDate === JSON_NULL || transaction.transactionDate <= toDate) &&
							(status === JSON_NULL || transaction.status === status)
					);

				return jsonResponse(paginated(transactions, url));
			}
			if (method === 'POST' && segments.length === 3) {
				const body = await readJson(request);

				return jsonResponse(
					useCases.ledger.create.execute({
						accountId: readString(body.accountId, 'accountId'),
						actorId: actor.id,
						amountMinor: readMinor(body.amountMinor),
						bookId: id,
						memo: typeof body.memo === 'string' ? body.memo : undefined,
						parts: readParts(body.parts),
						payee: typeof body.payee === 'string' ? body.payee : undefined,
						transactionDate: readString(body.transactionDate, 'transactionDate'),
					}),
					201
				);
			}
			if (method === 'PATCH' && childId && segments.length === 4) {
				const body = await readJson(request);
				const updated = useCases.ledger.update.execute(id, childId, {
					...(typeof body.accountId === 'string' && { accountId: body.accountId }),
					...(body.amountMinor !== undefined && { amountMinor: readMinor(body.amountMinor) }),
					...(body.parts !== undefined && { parts: readParts(body.parts) }),
					...(typeof body.memo === 'string' && { memo: body.memo }),
					...(typeof body.payee === 'string' && { payee: body.payee }),
					...(typeof body.transactionDate === 'string' && { transactionDate: body.transactionDate }),
				});

				return updated ? jsonResponse(updated) : jsonResponse({ error: 'Transaction not found' }, 404);
			}
			if (method === 'DELETE' && childId && segments.length === 4) {
				return useCases.ledger.delete.execute(id, childId)
					? new Response(JSON_NULL, { status: 204 })
					: jsonResponse({ error: 'Transaction not found or reconciled' }, 409);
			}
			if (method === 'PUT' && childId && segments.length === 5 && segments[4] === 'status') {
				const body = await readJson(request);
				if (body.status !== 'uncleared' && body.status !== 'cleared' && body.status !== 'reconciled') {
					throw new TypeError('status is invalid');
				}

				return useCases.ledger.setStatus.execute(id, childId, body.status)
					? new Response(JSON_NULL, { status: 204 })
					: jsonResponse({ error: 'Transaction not found or status transition is not allowed' }, 409);
			}
		}

		if (resource === 'books' && subresource === 'transfers' && method === 'POST') {
			const body = await readJson(request);

			return jsonResponse(
				useCases.ledger.createTransfer.execute({
					actorId: actor.id,
					amountMinor: readMinor(body.amountMinor),
					bookId: id,
					fromAccountId: readString(body.fromAccountId, 'fromAccountId'),
					memo: typeof body.memo === 'string' ? body.memo : undefined,
					toAccountId: readString(body.toAccountId, 'toAccountId'),
					transactionDate: readString(body.transactionDate, 'transactionDate'),
				}),
				201
			);
		}

		if (
			resource === 'books' &&
			id &&
			subresource === 'imports' &&
			(childId === 'preview' || childId === 'commit')
		) {
			const importRequest = await readImportRequest(request, id, actor.id);

			return childId === 'preview'
				? jsonResponse(useCases.imports.preview.execute(importRequest))
				: jsonResponse(useCases.imports.commit.execute(importRequest), 201);
		}

		return jsonResponse({ error: 'Not found' }, 404);
	} catch (error) {
		return routeError(error);
	}
}

export { type FinanceUseCases, handleFinanceRequest };
