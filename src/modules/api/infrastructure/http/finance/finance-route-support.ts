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
import { z } from 'zod';

import { JSON_NULL, jsonResponse } from '../shared/http-responses';
import { nonNegativeInteger, parseInput, requiredText } from '../shared/request-parsing';

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

interface FinanceEnvironment {
	Variables: { actor: RouteActor };
}

const pageQuerySchema = z.object({
	limit: nonNegativeInteger('limit', 100)
		.refine(value => value > 0, { error: 'limit must be greater than zero' })
		.default(100),
	offset: nonNegativeInteger('offset', Number.MAX_SAFE_INTEGER).default(0),
});

function paginated<T>(
	items: T[],
	query: Record<string, string>
): { items: T[]; limit: number; offset: number; total: number } {
	const { limit, offset } = parseInput(pageQuerySchema, query);

	return { items: items.slice(offset, offset + limit), limit, offset, total: items.length };
}

function isFlagEnabled(query: Record<string, string>, name: string): boolean {
	return query[name] === 'true';
}

async function readImportRequest(
	request: Request,
	bookId: string,
	actorId: string
): Promise<Parameters<PreviewStatementImport['execute']>[0]> {
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
	const accountId = parseInput(requiredText('accountId'), form.get('accountId'));
	const format = parseInput(requiredText('format'), form.get('format'));
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

export {
	type FinanceEnvironment,
	type FinanceUseCases,
	isFlagEnabled,
	paginated,
	readImportRequest,
	RequestTooLargeError,
	type RouteActor,
	routeError,
};
