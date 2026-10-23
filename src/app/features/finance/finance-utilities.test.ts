import { describe, expect, test } from 'bun:test';

import { formatDate, formatMinorUnits, minorUnitsToInput, parseMinorUnits } from './finance-utilities';

describe('finance utilities', () => {
	test('parses decimal amounts into currency minor units', () => {
		expect(parseMinorUnits('123.45', 'USD')).toBe(12_345);
		expect(parseMinorUnits('-0,50', 'EUR')).toBe(-50);
		expect(parseMinorUnits('12', 'JPY')).toBe(12);
	});

	test('rejects malformed and over-precise amounts', () => {
		expect(() => parseMinorUnits('1,234.56', 'USD')).toThrow();
		expect(() => parseMinorUnits('1.001', 'USD')).toThrow();
		expect(() => parseMinorUnits('1.1', 'JPY')).toThrow();
	});

	test('formats amounts and input values without losing minor units', () => {
		expect(minorUnitsToInput(-12_345, 'USD')).toBe('-123.45');
		expect(formatMinorUnits(12_345, 'USD', 'en')).toContain('123.45');
		expect(formatMinorUnits(12_345, 'USD', 'es')).toContain('123,45');
		expect(formatMinorUnits(12, 'JPY', 'en')).toContain('12');
	});

	test('formats dates consistently in English and Spanish', () => {
		expect(formatDate('2024-03-05', 'en')).toContain('Mar');
		expect(formatDate('2024-03-05', 'es')).toContain('mar');
		expect(formatDate('invalid', 'en')).toBe('invalid');
	});
});
