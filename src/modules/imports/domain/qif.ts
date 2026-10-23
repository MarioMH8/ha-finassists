import type { ImportIssue } from './import-error';
import { ImportError, issue } from './import-error';
import type { ImportLimits, ParsedStatement, SourceRecord } from './statement-import';

/**
 * MS Comptes Bancaires QIF dialect (single account per file).
 *
 * - First non-empty line must be `!Type:Bank|Cash|CCard|Oth A|Oth L` (case-insensitive); `!Option:`/`!Clear:` are skipped.
 * - Records end with `^`; a record left open at end of file is an error (truncated export).
 * - Imported: `D` date, `T` amount (`U` when `T` is absent), `P` payee, `M` memo.
 * - Not imported, counted in `ignoredFields`: `N` number, `C` cleared flag (all rows import as uncleared),
 *   `L` category / `[Account]` transfer target, `A` analysis class, `S`/`E`/`$` splits, and any other code.
 * - A record without date or amount is reported with its first line and is not imported.
 */
const ALLOWED_TYPES = new Set(['bank', 'cash', 'ccard', 'oth a', 'oth l']);

const IGNORED_LABELS: Record<string, string> = {
	$: 'splits',
	A: 'analysis-class',
	C: 'cleared-state',
	E: 'splits',
	L: 'category',
	N: 'number',
	S: 'splits',
};

interface OpenRecord {
	amount?: string;
	date?: string;
	ignored: Set<string>;
	memo: string;
	payee: string;
	startLine: number;
	touched: boolean;
	unitAmount?: string;
}

function applyField(record: OpenRecord, code: string, value: string): void {
	switch (code) {
		case 'D': {
			record.date = value;
			break;
		}
		case 'M': {
			record.memo = value;
			break;
		}
		case 'P': {
			record.payee = value;
			break;
		}
		case 'T': {
			record.amount = value;
			break;
		}
		case 'U': {
			record.unitAmount = value;
			break;
		}
		default: {
			record.ignored.add(IGNORED_LABELS[code] ?? `field-${code}`);
			if (code === 'L' && value.startsWith('[')) {
				record.ignored.add('transfer-target');
			}
		}
	}
}

function parseQif(text: string, limits: ImportLimits): ParsedStatement {
	const records: SourceRecord[] = [];
	const issues: ImportIssue[] = [];
	const ignoredFields: Record<string, number> = {};
	let isHeaderSeen = false;
	let current: OpenRecord | undefined;

	const open = (line: number): OpenRecord => {
		current ??= { ignored: new Set(), memo: '', payee: '', startLine: line, touched: false };

		return current;
	};

	const close = (): void => {
		const record = current;
		current = undefined;
		if (!record?.touched) {
			return;
		}
		for (const label of record.ignored) {
			ignoredFields[label] = (ignoredFields[label] ?? 0) + 1;
		}
		const amount = record.amount ?? record.unitAmount;
		if (record.date === undefined) {
			issues.push(
				issue(
					'missing-date',
					record.startLine,
					`Record starting on line ${String(record.startLine)} has no D (date) field.`
				)
			);
		}
		if (amount === undefined) {
			issues.push(
				issue(
					'missing-amount',
					record.startLine,
					`Record starting on line ${String(record.startLine)} has no T (amount) field.`
				)
			);
		}
		if (amount === undefined || record.date === undefined) {
			return;
		}
		records.push({
			amountText: amount,
			dateText: record.date,
			line: record.startLine,
			memo: record.memo,
			payee: record.payee,
		});
		if (records.length > limits.maxRecords) {
			throw new ImportError('too-many-records', `The file has more than ${String(limits.maxRecords)} records.`, {
				line: record.startLine,
			});
		}
	};

	const lines = text.split(/\r\n|\n|\r/);
	for (const [index, raw] of lines.entries()) {
		const line = raw.trim();
		if (line === '') {
			continue;
		}
		const lineNumber = index + 1;
		if (line.startsWith('!')) {
			const [name = '', ...rest] = line.slice(1).split(':');
			if (current?.touched) {
				throw new ImportError(
					'unterminated-record',
					`Record starting on line ${String(current.startLine)} is not closed by ^ before line ${String(lineNumber)}.`,
					{
						line: current.startLine,
					}
				);
			}
			const header = name.trim().toLowerCase();
			if (header === 'type') {
				const kind = rest.join(':').trim().toLowerCase();
				if (!ALLOWED_TYPES.has(kind)) {
					throw new ImportError(
						'unsupported-qif-type',
						`Unsupported QIF account type "${rest.join(':').trim()}" on line ${String(lineNumber)}.`,
						{
							line: lineNumber,
						}
					);
				}
				isHeaderSeen = true;
			} else if (header !== 'option' && header !== 'clear') {
				throw new ImportError(
					'unsupported-qif-header',
					`Unsupported QIF section "${line}" on line ${String(lineNumber)}.`,
					{
						line: lineNumber,
					}
				);
			}
			continue;
		}
		if (!isHeaderSeen) {
			throw new ImportError(
				'invalid-header',
				`Line ${String(lineNumber)}: expected a "!Type:Bank" header before any record.`,
				{
					line: lineNumber,
				}
			);
		}
		if (line === '^') {
			close();
			continue;
		}
		const code = line[0];
		const value = line.slice(1).trim();
		const record = open(lineNumber);
		record.touched = true;
		applyField(record, code, value);
	}
	if (current?.touched) {
		const start = current.startLine;
		throw new ImportError(
			'unterminated-record',
			`Record starting on line ${String(start)} is not closed by ^ at the end of the file.`,
			{
				line: start,
			}
		);
	}
	if (!isHeaderSeen) {
		throw new ImportError('invalid-header', 'The file has no "!Type:Bank" header.');
	}

	return { ignoredFields, issues, records };
}

export { parseQif };
