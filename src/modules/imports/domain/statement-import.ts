import type { ImportIssue } from './import-error';

const IMPORT_FORMATS = ['qif', 'payee_csv', 'statement_csv'] as const;

type ImportFormat = (typeof IMPORT_FORMATS)[number];

interface ImportLimits {
	maxBytes: number;
	maxRecords: number;
	maxReportedIssues: number;
}

const DEFAULT_IMPORT_LIMITS: ImportLimits = {
	maxBytes: 2 * 1024 * 1024,
	maxRecords: 5000,
	maxReportedIssues: 100,
};

// A file record before date/amount interpretation; texts are exactly what the file contained (trimmed).
interface SourceRecord {
	amountText: string;
	dateText: string;
	line: number;
	memo: string;
	payee: string;
}

interface ParsedStatement {
	// Counts of records that carried a field the importer deliberately does not store (category, splits, ...).
	ignoredFields: Record<string, number>;
	issues: ImportIssue[];
	records: SourceRecord[];
}

interface PayeeDirectoryEntry {
	active: boolean;
	code: string;
	line: number;
	name: string;
}

interface ParsedPayeeDirectory {
	entries: PayeeDirectoryEntry[];
	issues: ImportIssue[];
}

interface StatementImportRecord {
	accountId: string;
	bookId: string;
	contentHash: string;
	format: ImportFormat;
	id: string;
	importedAt: string;
}

interface RecordStatementImportInput {
	accountId: string;
	bookId: string;
	contentHash: string;
	format: ImportFormat;
}

interface StatementImportRepository {
	countMatching(
		bookId: string,
		accountId: string,
		transactionDate: string,
		amountMinor: number,
		payee: string
	): number;
	find(bookId: string, accountId: string, contentHash: string): StatementImportRecord | undefined;
	record(input: RecordStatementImportInput): StatementImportRecord;
	runAtomically<T>(work: () => T): T;
}

export {
	DEFAULT_IMPORT_LIMITS,
	IMPORT_FORMATS,
	type ImportFormat,
	type ImportLimits,
	type ParsedPayeeDirectory,
	type ParsedStatement,
	type PayeeDirectoryEntry,
	type RecordStatementImportInput,
	type SourceRecord,
	type StatementImportRecord,
	type StatementImportRepository,
};
