import type { ImportFormat, ImportIssue, PayeeDirectoryEntry, StatementImportRecord } from '@modules/imports/domain';

import type { ImportDependencies, ImportRequest } from './plan-import';
import { planImport } from './plan-import';

const JSON_NULL = JSON.parse('null') as null;

interface ImportPreviewRow {
	amountMinor: number;
	line: number;
	memo: string;
	payee: string;
	possibleDuplicate: boolean;
	transactionDate: string;
}

interface ImportPreview {
	accountId: string;
	bookId: string;
	canCommit: boolean;
	contentHash: string;
	currencyCode: string;
	errorCount: number;
	existingImport: null | StatementImportRecord;
	format: ImportFormat;
	ignoredFields: Record<string, number>;
	issues: ImportIssue[];
	payeeDirectory: PayeeDirectoryEntry[];
	payeesNormalized: number;
	rows: ImportPreviewRow[];
	summary: { firstDate: null | string; lastDate: null | string; rowCount: number; totalMinor: number };
	warningCount: number;
}

/**
 * Parses and validates a file against the selected book/account without writing anything.
 * File-level failures throw `ImportError`; row-level problems are returned in `issues`.
 */
class PreviewStatementImport {
	constructor(private readonly dependencies: ImportDependencies) {}

	execute(request: ImportRequest): ImportPreview {
		const plan = planImport(this.dependencies, request);
		const dates = plan.rows
			.map(row => row.input.transactionDate)
			.toSorted((left, right) => left.localeCompare(right));

		return {
			accountId: request.accountId,
			bookId: request.bookId,
			canCommit:
				request.format !== 'payee_csv' &&
				plan.existingImport === undefined &&
				plan.counts.errors === 0 &&
				plan.rows.length > 0,
			contentHash: plan.contentHash,
			currencyCode: plan.currencyCode,
			errorCount: plan.counts.errors,
			existingImport: plan.existingImport ?? JSON_NULL,
			format: request.format,
			ignoredFields: plan.ignoredFields,
			issues: plan.issues,
			payeeDirectory: plan.payeeDirectory,
			payeesNormalized: plan.payeesNormalized,
			rows: plan.rows.map(row => ({
				amountMinor: row.input.amountMinor,
				line: row.line,
				memo: row.input.memo ?? '',
				payee: row.input.payee ?? '',
				possibleDuplicate: row.possibleDuplicate,
				transactionDate: row.input.transactionDate,
			})),
			summary: {
				firstDate: dates[0] ?? JSON_NULL,
				lastDate: dates.at(-1) ?? JSON_NULL,
				rowCount: plan.rows.length,
				totalMinor: plan.rows.reduce((sum, row) => sum + row.input.amountMinor, 0),
			},
			warningCount: plan.counts.warnings,
		};
	}
}

export { type ImportPreview, type ImportPreviewRow, PreviewStatementImport };
