import { describe, expect, it } from 'bun:test';

import { Currency, Money } from '.';

describe('Money', () => {
	it.each([
		{ code: 'JPY', expected: 1200, input: '1200' },
		{ code: 'USD', expected: -1234, input: '-12.34' },
		{ code: 'KWD', expected: 1234, input: '1.234' },
	])('parses $input exactly for $code', ({ code, expected, input }) => {
		const currency = Currency.create(code);
		expect(Money.parse(input, currency).minorUnits).toBe(expected);
	});

	it('accepts only zero-valued excess fractional digits', () => {
		const usd = Currency.create('USD');
		expect(Money.parse('1.2300', usd).minorUnits).toBe(123);
		expect(() => Money.parse('1.2301', usd)).toThrow('exceeds 2 fractional digits');
	});

	it('adds and subtracts exact minor units', () => {
		const usd = Currency.create('USD');
		expect(Money.fromMinor(101, usd).add(Money.fromMinor(-1, usd)).minorUnits).toBe(100);
		expect(Money.fromMinor(100, usd).subtract(Money.fromMinor(101, usd)).minorUnits).toBe(-1);
	});

	it('rejects unsafe, malformed, overflowing and mixed-currency amounts', () => {
		const usd = Currency.create('USD');
		expect(() => Money.fromMinor(Number.MAX_SAFE_INTEGER + 1, usd)).toThrow('safe integer');
		expect(() => Money.parse('90071992547409.92', usd)).toThrow('safe integer range');
		expect(() => Money.parse('1,000.00', usd)).toThrow('decimal string');
		expect(() => Money.fromMinor(1, usd).add(Money.fromMinor(1, Currency.create('EUR')))).toThrow(
			'Cannot combine USD and EUR'
		);
	});

	it('derives fraction digits from currency metadata and formats for a locale', () => {
		expect(Currency.create('JPY').fractionDigits).toBe(0);
		expect(Currency.create('USD').fractionDigits).toBe(2);
		expect(Currency.create('KWD').fractionDigits).toBe(3);
		expect(Money.fromMinor(1234, Currency.create('KWD')).format('en')).toContain('1.234');
	});
});
