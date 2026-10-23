const JSON_NULL = JSON.parse('null') as null;

type ImportCode =
	| 'account-closed'
	| 'account-not-found'
	| 'binary-content'
	| 'book-archived'
	| 'book-not-found'
	| 'commit-failed'
	| 'duplicate-payee'
	| 'empty-file'
	| 'file-too-large'
	| 'invalid-amount'
	| 'invalid-date'
	| 'invalid-header'
	| 'invalid-row'
	| 'invalid-rows'
	| 'malformed-csv'
	| 'malformed-row'
	| 'missing-amount'
	| 'missing-date'
	| 'missing-payee-name'
	| 'no-rows'
	| 'payee-directory-not-persistable'
	| 'possible-duplicate'
	| 'too-many-records'
	| 'unsupported-encoding'
	| 'unsupported-qif-header'
	| 'unsupported-qif-type'
	| 'unterminated-record';

type ImportIssueSeverity = 'error' | 'warning';

interface ImportIssue {
	code: ImportCode;
	line: number;
	message: string;
	severity: ImportIssueSeverity;
}

// Every code carries a fixed, user-facing remediation so callers can surface it without extra mapping.
const IMPORT_ACTIONS: Record<ImportCode, string> = {
	'account-closed': 'Reopen the account or select an open account before importing.',
	'account-not-found': 'Select an existing account that belongs to the selected book.',
	'binary-content': 'Upload the plain-text export (QIF or CSV), not a binary or UTF-16 file.',
	'book-archived': 'Select an active book; archived books are read-only.',
	'book-not-found': 'Select an existing book.',
	'commit-failed': 'Nothing was imported. Fix the reported row and retry the same file.',
	'duplicate-payee': 'Remove the repeated payee name from the directory file.',
	'empty-file': 'Select a file that contains at least one record.',
	'file-too-large': 'Split the export into smaller files (for example one per year) and import them one by one.',
	'invalid-amount':
		'Correct the amount: use one decimal separator and no more decimals than the book currency allows.',
	'invalid-date': 'Correct the date to a valid calendar day in a supported format.',
	'invalid-header': 'Use the documented column header for this format.',
	'invalid-row': 'Correct the reported row; the transaction rules reject its values.',
	'invalid-rows':
		'Fix every reported row in the source file and preview again; no row is imported when any row is invalid.',
	'malformed-csv': 'Check the CSV quoting and delimiter, then export the file again.',
	'malformed-row': 'Give the row exactly the documented number of columns.',
	'missing-amount': 'Add the amount field to the record.',
	'missing-date': 'Add the date field to the record.',
	'missing-payee-name': 'Fill in the payee name (Lib column) for the row.',
	'no-rows': 'The file contains no importable transactions.',
	'payee-directory-not-persistable':
		'Use the payee directory as the payeeDirectory companion of a QIF or statement CSV import.',
	'possible-duplicate': 'Review whether this row was already entered manually or via an overlapping file.',
	'too-many-records': 'Split the export into smaller files and import them one by one.',
	'unsupported-encoding': 'Re-export the file as UTF-8 (QIF and payee files may also be Windows-1252).',
	'unsupported-qif-header': 'Export one account per QIF file and remove account-list sections.',
	'unsupported-qif-type': 'Export a bank, cash or credit-card account; investment accounts are not supported.',
	'unterminated-record': 'The QIF file looks truncated: every record must end with a ^ line. Export it again.',
};

class ImportError extends Error {
	readonly action: string;
	readonly issues: readonly ImportIssue[];
	readonly line: null | number;

	constructor(
		readonly code: ImportCode,
		message: string,
		options: { issues?: readonly ImportIssue[]; line?: number } = {}
	) {
		super(message);
		this.name = 'ImportError';
		this.action = IMPORT_ACTIONS[code];
		this.issues = options.issues ?? [];
		this.line = options.line ?? JSON_NULL;
	}
}

function issue(code: ImportCode, line: number, message: string, severity: ImportIssueSeverity = 'error'): ImportIssue {
	return { code, line, message, severity };
}

export { IMPORT_ACTIONS, type ImportCode, ImportError, type ImportIssue, type ImportIssueSeverity, issue };
