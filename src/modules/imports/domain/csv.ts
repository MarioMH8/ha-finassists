import { ImportError } from './import-error';

interface CsvRow {
	cells: string[];
	line: number;
}

/**
 * Minimal RFC 4180 reader: quoted cells, doubled quotes, embedded newlines, LF/CRLF/CR row ends.
 * Blank rows are skipped. Row numbers are 1-based file lines of the row start. Stops with `too-many-records`
 * as soon as more than `maxRows` rows (header included) have been read.
 */
function readCsv(text: string, delimiter: string, maxRows: number): CsvRow[] {
	const rows: CsvRow[] = [];
	let cells: string[] = [];
	let cell = '';
	let isInQuotes = false;
	let isAfterQuote = false;
	let quoteLine = 1;
	let line = 1;
	let rowLine = 1;

	const endRow = (): void => {
		cells.push(cell);
		if (!(cells.length === 1 && cells[0]?.trim() === '')) {
			rows.push({ cells, line: rowLine });
			if (rows.length > maxRows) {
				throw new ImportError('too-many-records', `The file has more than ${String(maxRows - 1)} records.`);
			}
		}
		cells = [];
		cell = '';
		isAfterQuote = false;
	};

	for (let index = 0; index < text.length; index++) {
		const char = text[index];
		if (isInQuotes) {
			if (char === '"') {
				if (text[index + 1] === '"') {
					cell += '"';
					index++;
				} else {
					isInQuotes = false;
					isAfterQuote = true;
				}
			} else {
				cell += char;
				if (char === '\n') {
					line++;
				}
			}
			continue;
		}
		if (char !== '\n' && isAfterQuote && char !== delimiter && char !== '\r') {
			throw new ImportError(
				'malformed-csv',
				`Unexpected character after a closing quote on line ${String(line)}.`,
				{
					line,
				}
			);
		}
		if (char === '"' && cell === '' && !isAfterQuote) {
			isInQuotes = true;
			quoteLine = line;
		} else if (char === delimiter) {
			cells.push(cell);
			cell = '';
			isAfterQuote = false;
		} else if (char === '\n' || char === '\r') {
			if (char === '\r' && text[index + 1] === '\n') {
				index++;
			}
			endRow();
			line++;
			rowLine = line;
		} else {
			cell += char;
		}
	}
	if (isInQuotes) {
		throw new ImportError('malformed-csv', `A quoted value opened on line ${String(quoteLine)} is never closed.`, {
			line: quoteLine,
		});
	}
	if (isAfterQuote || cell !== '' || cells.length > 0) {
		endRow();
	}

	return rows;
}

export { type CsvRow, readCsv };
