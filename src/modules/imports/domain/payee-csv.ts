import { readCsv } from './csv';
import type { ImportIssue } from './import-error';
import { ImportError, issue } from './import-error';
import type { ImportLimits, ParsedPayeeDirectory, PayeeDirectoryEntry } from './statement-import';

/**
 * MS Comptes Bancaires payee export dialect: `;` delimiter, header row, UTF-8 or Windows-1252.
 * Only `Lib` (name, required), `Code` and `Actif` (`0` means inactive) are read. Every other column
 * (addresses, phones, bank details, IBAN, notes, ...) is personal data and is never read or retained.
 * The file is a payee directory: it canonicalises payee names of a statement import, it creates no rows.
 */
function normalizePayeeName(name: string): string {
	return name.normalize('NFKD').replaceAll(/\p{M}/gu, '').replaceAll(/\s+/g, ' ').trim().toLowerCase();
}

function parsePayeeCsv(text: string, limits: ImportLimits): ParsedPayeeDirectory {
	const rows = readCsv(text, ';', limits.maxRecords + 1);
	const header = rows[0];
	const names = header.cells.map(cell => cell.trim().toLowerCase());
	const nameColumn = names.indexOf('lib');
	if (nameColumn === -1) {
		throw new ImportError('invalid-header', 'The payee file has no "Lib" column (semicolon-separated header).', {
			line: header.line,
		});
	}
	const codeColumn = names.indexOf('code');
	const activeColumn = names.indexOf('actif');
	const entries: PayeeDirectoryEntry[] = [];
	const issues: ImportIssue[] = [];
	const seen = new Map<string, number>();
	for (const row of rows.slice(1)) {
		const name = (row.cells[nameColumn] ?? '').trim();
		if (name === '') {
			issues.push(issue('missing-payee-name', row.line, `Line ${String(row.line)} has an empty Lib value.`));
			continue;
		}
		const key = normalizePayeeName(name);
		const firstLine = seen.get(key);
		if (firstLine !== undefined) {
			issues.push(
				issue(
					'duplicate-payee',
					row.line,
					`Line ${String(row.line)} repeats the payee of line ${String(firstLine)} ("${name}").`
				)
			);
			continue;
		}
		seen.set(key, row.line);
		entries.push({
			active: activeColumn === -1 ? true : (row.cells[activeColumn] ?? '').trim() !== '0',
			code: codeColumn === -1 ? '' : (row.cells[codeColumn] ?? '').trim(),
			line: row.line,
			name,
		});
	}

	return { entries, issues };
}

export { normalizePayeeName, parsePayeeCsv };
