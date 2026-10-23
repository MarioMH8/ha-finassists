import { describe, expect, it } from 'bun:test';

import { PAYEE_CSV, QIF_BASIC, QIF_OPTION_AND_SPLIT, STATEMENT_CSV, toUtf8, toWindows1252 } from '../fixtures';
import {
	assertWithinLimits,
	decodeText,
	DEFAULT_IMPORT_LIMITS,
	hashContent,
	ImportError,
	normalizeLocalizedAmount,
	normalizePayeeName,
	normalizeStrictAmount,
	parseDayFirstDate,
	parseIsoDate,
	parsePayeeCsv,
	parseQif,
	parseStatementCsv,
	readCsv,
} from '.';

const limits = DEFAULT_IMPORT_LIMITS;

function codeOf(work: () => unknown): string {
	try {
		work();
	} catch (error) {
		if (error instanceof ImportError) {
			return error.code;
		}
		throw error;
	}

	return 'none';
}

describe('QIF parser', () => {
	it('reads date, amount, payee and memo and counts ignored fields', () => {
		const parsed = parseQif(QIF_BASIC, limits);
		expect(parsed.issues).toEqual([]);
		expect(parsed.records).toEqual([
			{ amountText: '-12,50', dateText: '05/01/2024', line: 2, memo: 'Lunch', payee: 'Café Demo' },
			{ amountText: '1 234,56', dateText: '06/01/2024', line: 9, memo: '', payee: 'Employer Demo' },
		]);
		expect(parsed.ignoredFields).toEqual({ category: 1, number: 1 });
	});

	it('skips option headers and reports splits and transfers as ignored', () => {
		const parsed = parseQif(QIF_OPTION_AND_SPLIT, limits);
		expect(parsed.records).toHaveLength(1);
		expect(parsed.ignoredFields).toMatchObject({ 'cleared-state': 1, splits: 1, 'transfer-target': 1 });
	});

	it('rejects a missing header, unsupported types and truncated records', () => {
		expect(codeOf(() => parseQif('D01/01/2024\nT1\n^\n', limits))).toBe('invalid-header');
		expect(codeOf(() => parseQif('!Type:Invst\n', limits))).toBe('unsupported-qif-type');
		expect(codeOf(() => parseQif('!Account\nNx\n^\n', limits))).toBe('unsupported-qif-header');
		expect(codeOf(() => parseQif('!Type:Bank\nD01/01/2024\nT1\n', limits))).toBe('unterminated-record');
	});

	it('reports records without date or amount with their line', () => {
		const parsed = parseQif('!Type:Bank\nT1\n^\nD01/01/2024\n^\n', limits);
		expect(parsed.records).toEqual([]);
		expect(parsed.issues.map(item => [item.code, item.line])).toEqual([
			['missing-date', 2],
			['missing-amount', 4],
		]);
	});

	it('caps the number of records', () => {
		const text = '!Type:Bank\nD01/01/2024\nT1\n^\nD01/01/2024\nT1\n^\n';
		expect(codeOf(() => parseQif(text, { ...limits, maxRecords: 1 }))).toBe('too-many-records');
	});
});

describe('QIF dialect', () => {
	it('parses day-first dates in the supported forms', () => {
		expect(parseDayFirstDate('05/01/2024')).toBe('2024-01-05');
		expect(parseDayFirstDate('05-01-2024')).toBe('2024-01-05');
		expect(parseDayFirstDate('05.01.2024')).toBe('2024-01-05');
		expect(parseDayFirstDate('05/01/24')).toBe('2024-01-05');
		expect(parseDayFirstDate(`05/01'24`)).toBe('2024-01-05');
		expect(parseDayFirstDate('05/01/99')).toBe('1999-01-05');
		expect(parseDayFirstDate('2024-01-05')).toBe('2024-01-05');
	});

	it('rejects impossible and ambiguous dates', () => {
		expect(parseDayFirstDate('31/02/2024')).toBeUndefined();
		expect(parseDayFirstDate('13/13/2024')).toBeUndefined();
		expect(parseDayFirstDate('hello')).toBeUndefined();
		expect(parseIsoDate('05/01/2024')).toBeUndefined();
		expect(parseIsoDate('2024-02-30')).toBeUndefined();
		expect(parseIsoDate('2024-02-29')).toBe('2024-02-29');
	});

	it('normalizes localized amounts', () => {
		expect(normalizeLocalizedAmount('-12,50')).toBe('-12.50');
		expect(normalizeLocalizedAmount('1 234,56')).toBe('1234.56');
		expect(normalizeLocalizedAmount('1.234,56')).toBe('1234.56');
		expect(normalizeLocalizedAmount('1,234.56')).toBe('1234.56');
		expect(normalizeLocalizedAmount('+5')).toBe('5');
		expect(normalizeLocalizedAmount('abc')).toBeUndefined();
		expect(normalizeLocalizedAmount('')).toBeUndefined();
	});

	it('is strict for CSV amounts', () => {
		expect(normalizeStrictAmount('-9.99')).toBe('-9.99');
		expect(normalizeStrictAmount('9,99')).toBeUndefined();
		expect(normalizeStrictAmount('1 000')).toBeUndefined();
	});
});

describe('statement CSV parser', () => {
	it('reads the documented header and quoted fields', () => {
		const parsed = parseStatementCsv(STATEMENT_CSV, limits);
		expect(parsed.issues).toEqual([]);
		expect(parsed.records).toEqual([
			{ amountText: '-9.99', dateText: '2024-02-01', line: 2, memo: 'Monthly', payee: 'Streaming Demo' },
			{ amountText: '100.00', dateText: '2024-02-02', line: 3, memo: 'Salary, February', payee: 'Employer Demo' },
		]);
	});

	it('rejects a different header', () => {
		expect(codeOf(() => parseStatementCsv('Date;Montant\n1;2\n', limits))).toBe('invalid-header');
	});

	it('flags malformed rows with their line', () => {
		const parsed = parseStatementCsv('date,amount,payee,memo\n2024-01-01,1,Only three\n,,,\n', limits);
		expect(parsed.issues.map(item => [item.code, item.line])).toEqual([
			['malformed-row', 2],
			['missing-date', 3],
			['missing-amount', 3],
		]);
	});

	it('caps records', () => {
		expect(codeOf(() => parseStatementCsv(STATEMENT_CSV, { ...limits, maxRecords: 1 }))).toBe('too-many-records');
	});
});

describe('payee CSV parser', () => {
	it('reads only the Lib, Code and Actif columns', () => {
		const parsed = parsePayeeCsv(PAYEE_CSV, limits);
		expect(parsed.issues).toEqual([]);
		expect(parsed.entries.map(entry => [entry.name, entry.code, entry.active])).toEqual([
			['Café Demo', 'CD1', true],
			['Shop Demo', 'SD1', false],
		]);
	});

	it('reports missing and duplicate names', () => {
		const parsed = parsePayeeCsv('Lib;Code\nA;1\n;2\na;3\n', limits);
		expect(parsed.issues.map(item => [item.code, item.line])).toEqual([
			['missing-payee-name', 3],
			['duplicate-payee', 4],
		]);
	});

	it('requires the Lib column', () => {
		expect(codeOf(() => parsePayeeCsv('Name;Code\nA;1\n', limits))).toBe('invalid-header');
	});

	it('normalizes names for matching', () => {
		expect(normalizePayeeName('  CAFÉ   Demo ')).toBe(normalizePayeeName('cafe demo'));
	});
});

describe('CSV reader', () => {
	it('handles quotes, escaped quotes, embedded newlines and blank rows', () => {
		const rows = readCsv('a,"b ""q"""\n\n"x\ny",z\n', ',', 10);
		expect(rows).toEqual([
			{ cells: ['a', 'b "q"'], line: 1 },
			{ cells: ['x\ny', 'z'], line: 3 },
		]);
	});

	it('rejects unterminated quotes and text after a closing quote', () => {
		expect(codeOf(() => readCsv('a,"b\n', ',', 10))).toBe('malformed-csv');
		expect(codeOf(() => readCsv('"a"b,c\n', ',', 10))).toBe('malformed-csv');
	});

	it('caps rows', () => {
		expect(codeOf(() => readCsv('a\nb\nc\n', ',', 2))).toBe('too-many-records');
	});
});

describe('content guards', () => {
	it('enforces the byte cap at the boundary', () => {
		expect(codeOf(() => assertWithinLimits(new Uint8Array(limits.maxBytes), limits))).toBe('none');
		expect(codeOf(() => assertWithinLimits(new Uint8Array(limits.maxBytes + 1), limits))).toBe('file-too-large');
		expect(codeOf(() => assertWithinLimits(new Uint8Array(0), limits))).toBe('empty-file');
	});

	it('decodes UTF-8 with or without BOM and falls back to Windows-1252 only when allowed', () => {
		const bom = new Uint8Array([239, 187, 191, ...toUtf8('é')]);
		expect(decodeText(bom, false)).toBe('é');
		expect(decodeText(toUtf8('é'), false)).toBe('é');
		expect(decodeText(toWindows1252('é'), true)).toBe('é');
		expect(codeOf(() => decodeText(toWindows1252('é'), false))).toBe('unsupported-encoding');
	});

	it('rejects UTF-16, NUL bytes and blank files', () => {
		expect(codeOf(() => decodeText(new Uint8Array([255, 254, 65, 0]), true))).toBe('unsupported-encoding');
		expect(codeOf(() => decodeText(new Uint8Array([0x41, 0x00, 0x42]), true))).toBe('binary-content');
		expect(codeOf(() => decodeText(toUtf8('  \n '), true))).toBe('empty-file');
	});

	it('hashes bytes deterministically', () => {
		expect(hashContent(toUtf8('a'))).toBe(hashContent(toUtf8('a')));
		expect(hashContent(toUtf8('a'))).not.toBe(hashContent(toUtf8('b')));
		expect(hashContent(toUtf8('a'))).toHaveLength(64);
	});
});
