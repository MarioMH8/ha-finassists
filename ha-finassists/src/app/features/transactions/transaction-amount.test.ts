import { describe, expect, test } from 'bun:test';

import {
	AMOUNT_ERROR,
	currencyFractionDigits,
	formatDate,
	formatMinorUnits,
	parseAmountMinor,
} from './transaction-amount';

describe('parseAmountMinor', () => {
	test('parses decimal amounts using the currency fraction digits', () => {
		expect(parseAmountMinor('123.45', 'USD')).toEqual({ minor: 12_345 });
		expect(parseAmountMinor('0,5', 'EUR')).toEqual({ minor: 50 });
		expect(parseAmountMinor(' 12 ', 'EUR')).toEqual({ minor: 1200 });
		expect(parseAmountMinor('.25', 'EUR')).toEqual({ minor: 25 });
		expect(parseAmountMinor('12', 'JPY')).toEqual({ minor: 12 });
		expect(parseAmountMinor('1.234', 'KWD')).toEqual({ minor: 1234 });
	});

	test('rejects empty and malformed amounts', () => {
		expect(parseAmountMinor('', 'EUR')).toEqual({ error: AMOUNT_ERROR.REQUIRED });
		expect(parseAmountMinor(' '.repeat(3), 'EUR')).toEqual({ error: AMOUNT_ERROR.REQUIRED });
		expect(parseAmountMinor('abc', 'EUR')).toEqual({ error: AMOUNT_ERROR.INVALID });
		expect(parseAmountMinor('1,234.56', 'USD')).toEqual({ error: AMOUNT_ERROR.INVALID });
		expect(parseAmountMinor('1e3', 'EUR')).toEqual({ error: AMOUNT_ERROR.INVALID });
	});

	test('rejects zero and negative amounts', () => {
		expect(parseAmountMinor('0', 'EUR')).toEqual({ error: AMOUNT_ERROR.NOT_POSITIVE });
		expect(parseAmountMinor('0.00', 'EUR')).toEqual({ error: AMOUNT_ERROR.NOT_POSITIVE });
		expect(parseAmountMinor('-5', 'EUR')).toEqual({ error: AMOUNT_ERROR.NOT_POSITIVE });
	});

	test('rejects amounts with more decimals than the currency allows', () => {
		expect(parseAmountMinor('1.001', 'USD')).toEqual({ error: AMOUNT_ERROR.PRECISION });
		expect(parseAmountMinor('1.1', 'JPY')).toEqual({ error: AMOUNT_ERROR.PRECISION });
	});

	test('rejects amounts beyond the safe integer range', () => {
		expect(parseAmountMinor('90071992547409.92', 'USD')).toEqual({ error: AMOUNT_ERROR.TOO_LARGE });
	});
});

describe('amount formatting', () => {
	test('resolves currency fraction digits', () => {
		expect(currencyFractionDigits('EUR')).toBe(2);
		expect(currencyFractionDigits('JPY')).toBe(0);
		expect(currencyFractionDigits('KWD')).toBe(3);
	});

	test('formats minor units in the requested language', () => {
		expect(formatMinorUnits(12_345, 'USD', 'en')).toContain('123.45');
		expect(formatMinorUnits(12_345, 'USD', 'es')).toContain('123,45');
		expect(formatMinorUnits(12, 'JPY', 'en')).toContain('12');
	});

	test('shows an explicit sign only when requested', () => {
		expect(formatMinorUnits(-1050, 'EUR', 'en', 'exceptZero')).toContain('-');
		expect(formatMinorUnits(1050, 'EUR', 'en', 'exceptZero')).toContain('+');
		expect(formatMinorUnits(0, 'EUR', 'en', 'exceptZero')).not.toMatch(/[+-]/u);
		expect(formatMinorUnits(1050, 'EUR', 'en')).not.toContain('+');
	});

	test('formats dates in English and Spanish and keeps invalid values', () => {
		expect(formatDate('2024-03-05', 'en')).toContain('Mar');
		expect(formatDate('2024-03-05', 'es')).toContain('mar');
		expect(formatDate('invalid', 'en')).toBe('invalid');
	});
});
