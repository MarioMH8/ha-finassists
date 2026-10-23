import type { AccountRepository } from '@modules/accounts/domain';
import type { BookRepository } from '@modules/books/domain';
import type { CreateTransactionInput } from '@modules/ledger/domain';
import { validateTransactionInput } from '@modules/ledger/domain';
import { Currency, Money } from '@modules/money/domain';

import type {
	ImportFormat,
	ImportIssue,
	ImportLimits,
	ParsedStatement,
	PayeeDirectoryEntry,
	SourceRecord,
	StatementImportRecord,
	StatementImportRepository,
} from '../domain';
import {
	assertWithinLimits,
	decodeText,
	DEFAULT_IMPORT_LIMITS,
	hashContent,
	ImportError,
	issue,
	normalizeLocalizedAmount,
	normalizePayeeName,
	normalizeStrictAmount,
	parseDayFirstDate,
	parseIsoDate,
	parsePayeeCsv,
	parseQif,
	parseStatementCsv,
} from '../domain';

interface ImportRequest {
	accountId: string;
	actorId?: string;
	bookId: string;
	content: Uint8Array;
	format: ImportFormat;
	// Optional payee CSV bytes used to canonicalise payee names; not part of the idempotency hash.
	payeeDirectory?: Uint8Array;
}

interface ImportDependencies {
	accounts: AccountRepository;
	books: BookRepository;
	imports: StatementImportRepository;
	limits?: Partial<ImportLimits>;
}

interface PlannedRow {
	input: CreateTransactionInput;
	line: number;
	possibleDuplicate: boolean;
}

interface ImportPlan {
	contentHash: string;
	counts: { errors: number; warnings: number };
	currencyCode: string;
	existingImport: StatementImportRecord | undefined;
	ignoredFields: Record<string, number>;
	issues: ImportIssue[];
	payeeDirectory: PayeeDirectoryEntry[];
	payeesNormalized: number;
	rows: PlannedRow[];
}

function resolveLimits(limits: Partial<ImportLimits> | undefined): ImportLimits {
	return { ...DEFAULT_IMPORT_LIMITS, ...limits };
}

function selectBookAndAccount(dependencies: ImportDependencies, bookId: string, accountId: string): string {
	const book = dependencies.books.find(bookId);
	if (!book) {
		throw new ImportError('book-not-found', `Book "${bookId}" does not exist.`);
	}
	if (book.archivedAt) {
		throw new ImportError('book-archived', `Book "${book.name}" is archived.`);
	}
	const account = dependencies.accounts.find(bookId, accountId);
	if (!account) {
		throw new ImportError('account-not-found', `Account "${accountId}" does not exist in book "${book.name}".`);
	}
	if (account.closedAt) {
		throw new ImportError('account-closed', `Account "${account.name}" is closed.`);
	}

	return book.currencyCode;
}

function parseContent(
	request: ImportRequest,
	limits: ImportLimits
): { directory: PayeeDirectoryEntry[]; issues: ImportIssue[]; statement: ParsedStatement } {
	const text = decodeText(request.content, request.format !== 'statement_csv');
	if (request.format === 'payee_csv') {
		const directory = parsePayeeCsv(text, limits);

		return {
			directory: directory.entries,
			issues: directory.issues,
			statement: { ignoredFields: {}, issues: [], records: [] },
		};
	}
	const statement = request.format === 'qif' ? parseQif(text, limits) : parseStatementCsv(text, limits);
	let directory: PayeeDirectoryEntry[] = [];
	const issues: ImportIssue[] = [];
	if (request.payeeDirectory) {
		assertWithinLimits(request.payeeDirectory, limits);
		const parsed = parsePayeeCsv(decodeText(request.payeeDirectory, true), limits);
		directory = parsed.entries;
		issues.push(...parsed.issues);
	}

	return { directory, issues, statement };
}

interface RowSyntax {
	amount: (text: string) => string | undefined;
	date: (text: string) => string | undefined;
	dateHint: string;
}

const QIF_SYNTAX: RowSyntax = {
	amount: normalizeLocalizedAmount,
	date: parseDayFirstDate,
	dateHint: `DD/MM/YYYY, DD/MM/YY, DD/MM'YY, DD-MM-YYYY, DD.MM.YYYY or YYYY-MM-DD`,
};
const CSV_SYNTAX: RowSyntax = { amount: normalizeStrictAmount, date: parseIsoDate, dateHint: 'YYYY-MM-DD' };

function planRows(
	request: ImportRequest,
	records: SourceRecord[],
	currency: Currency,
	directory: PayeeDirectoryEntry[],
	dependencies: ImportDependencies,
	issues: ImportIssue[]
): { payeesNormalized: number; rows: PlannedRow[] } {
	const syntax = request.format === 'qif' ? QIF_SYNTAX : CSV_SYNTAX;
	const canonical = new Map(directory.map(entry => [normalizePayeeName(entry.name), entry.name]));
	const occurrences = new Map<string, number>();
	const rows: PlannedRow[] = [];
	let payeesNormalized = 0;

	for (const record of records) {
		const transactionDate = syntax.date(record.dateText);
		if (transactionDate === undefined) {
			issues.push(
				issue(
					'invalid-date',
					record.line,
					`Line ${String(record.line)}: "${record.dateText}" is not a valid date; expected ${syntax.dateHint}.`
				)
			);
			continue;
		}
		const normalizedAmount = syntax.amount(record.amountText);
		let amountMinor: number;
		try {
			if (normalizedAmount === undefined) {
				throw new Error('not a number');
			}
			amountMinor = Money.parse(normalizedAmount, currency).minorUnits;
		} catch (error) {
			const reason = normalizedAmount === undefined ? 'it is not a number' : (error as Error).message;
			issues.push(
				issue(
					'invalid-amount',
					record.line,
					`Line ${String(record.line)}: amount "${record.amountText}" is rejected (${reason}); book currency is ${currency.code}.`
				)
			);
			continue;
		}
		const known = record.payee === '' ? undefined : canonical.get(normalizePayeeName(record.payee));
		const payee = known ?? record.payee;
		if (known !== undefined && known !== record.payee) {
			payeesNormalized++;
		}
		const input: CreateTransactionInput = {
			accountId: request.accountId,
			amountMinor,
			bookId: request.bookId,
			transactionDate,
			...(request.actorId !== undefined && { actorId: request.actorId }),
			...(record.memo !== '' && { memo: record.memo }),
			...(payee !== '' && { payee }),
		};
		try {
			validateTransactionInput(input);
		} catch (error) {
			issues.push(issue('invalid-row', record.line, `Line ${String(record.line)}: ${(error as Error).message}.`));
			continue;
		}
		const key = `${transactionDate}|${String(amountMinor)}|${payee.trim()}`;
		const seenInFile = occurrences.get(key) ?? 0;
		occurrences.set(key, seenInFile + 1);
		const stored = dependencies.imports.countMatching(
			request.bookId,
			request.accountId,
			transactionDate,
			amountMinor,
			payee.trim()
		);
		const isPossibleDuplicate = stored > seenInFile;
		if (isPossibleDuplicate) {
			issues.push(
				issue(
					'possible-duplicate',
					record.line,
					`Line ${String(record.line)}: an identical transaction (same date, amount and payee) already exists in this account.`,
					'warning'
				)
			);
		}
		rows.push({ input, line: record.line, possibleDuplicate: isPossibleDuplicate });
	}

	return { payeesNormalized, rows };
}

function planImport(dependencies: ImportDependencies, request: ImportRequest): ImportPlan {
	const limits = resolveLimits(dependencies.limits);
	const currencyCode = selectBookAndAccount(dependencies, request.bookId, request.accountId);
	assertWithinLimits(request.content, limits);
	const contentHash = hashContent(request.content);
	const { directory, issues: directoryIssues, statement } = parseContent(request, limits);
	const issues = [...directoryIssues, ...statement.issues];
	const { payeesNormalized, rows } = planRows(
		request,
		statement.records,
		Currency.create(currencyCode),
		directory,
		dependencies,
		issues
	);
	issues.sort((a, b) => a.line - b.line);

	return {
		contentHash,
		counts: {
			errors: issues.filter(item => item.severity === 'error').length,
			warnings: issues.filter(item => item.severity === 'warning').length,
		},
		currencyCode,
		existingImport: dependencies.imports.find(request.bookId, request.accountId, contentHash),
		ignoredFields: statement.ignoredFields,
		issues: issues.slice(0, limits.maxReportedIssues),
		payeeDirectory: request.format === 'payee_csv' ? directory : [],
		payeesNormalized,
		rows,
	};
}

export { type ImportDependencies, type ImportPlan, type ImportRequest, planImport, type PlannedRow };
