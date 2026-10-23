import { readCsv } from './csv';
import type { ImportIssue } from './import-error';
import { ImportError, issue } from './import-error';
import type { ImportLimits, ParsedStatement, SourceRecord } from './statement-import';

/**
 * Statement CSV contract (the only generic CSV dialect accepted):
 *
 * - UTF-8 (BOM allowed), comma delimiter, RFC 4180 quoting, LF or CRLF.
 * - Header exactly `date,amount,payee,memo` (case-insensitive), in that order, four columns on every row.
 * - `date`: `YYYY-MM-DD`. `amount`: signed decimal with `.` as separator, no thousands separators,
 *   in the book currency; negative means money leaving the account. `payee` and `memo` may be empty.
 */
const STATEMENT_CSV_HEADER = ['date', 'amount', 'payee', 'memo'] as const;

function parseStatementCsv(text: string, limits: ImportLimits): ParsedStatement {
	const rows = readCsv(text, ',', limits.maxRecords + 1);
	const header = rows[0];
	const found = header.cells.map(cell => cell.trim().toLowerCase());
	if (
		found.length !== STATEMENT_CSV_HEADER.length ||
		found.some((cell, index) => cell !== STATEMENT_CSV_HEADER[index])
	) {
		throw new ImportError(
			'invalid-header',
			`Expected the header "${STATEMENT_CSV_HEADER.join(',')}" but found "${found.join(',')}".`,
			{ line: header.line }
		);
	}
	const records: SourceRecord[] = [];
	const issues: ImportIssue[] = [];
	for (const row of rows.slice(1)) {
		if (row.cells.length !== STATEMENT_CSV_HEADER.length) {
			issues.push(
				issue(
					'malformed-row',
					row.line,
					`Line ${String(row.line)} has ${String(row.cells.length)} columns; expected ${String(STATEMENT_CSV_HEADER.length)}.`
				)
			);
			continue;
		}
		const [dateText = '', amountText = '', payee = '', memo = ''] = row.cells.map(cell => cell.trim());
		if (dateText === '') {
			issues.push(issue('missing-date', row.line, `Line ${String(row.line)} has an empty date.`));
		}
		if (amountText === '') {
			issues.push(issue('missing-amount', row.line, `Line ${String(row.line)} has an empty amount.`));
		}
		if (dateText === '' || amountText === '') {
			continue;
		}
		records.push({ amountText, dateText, line: row.line, memo, payee });
	}

	return { ignoredFields: {}, issues, records };
}

export { parseStatementCsv, STATEMENT_CSV_HEADER };
