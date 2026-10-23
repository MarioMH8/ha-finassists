import { Currency } from '@modules/money/domain';
import { describe, expect, it } from 'bun:test';

import { createAccount, deriveAccountBalances } from '.';

const JSON_NULL = JSON.parse('null') as null;

const usd = Currency.create('USD');
const valid = { bookId: 'book', currency: usd, id: 'account', kind: 'checking', name: 'Main', openingBalanceMinor: 0 };

describe('createAccount', () => {
	it('trims names and keeps negative opening balances', () => {
		const account = createAccount({ ...valid, name: '  Card  ', openingBalanceMinor: -2500 });

		expect(account).toMatchObject({ closedAt: JSON_NULL, name: 'Card', openingBalanceMinor: -2500 });
	});

	it.each([
		{ message: 'between 1 and 80', name: ' '.repeat(3) },
		{ message: 'between 1 and 80', name: 'x'.repeat(81) },
	])('rejects invalid name', ({ message, name }) => {
		expect(() => createAccount({ ...valid, name })).toThrow(message);
	});

	it('rejects unknown kinds and blank identifiers', () => {
		expect(() => createAccount({ ...valid, kind: 'crypto' })).toThrow('Account kind');
		expect(() => createAccount({ ...valid, id: ' ' })).toThrow('Account id');
		expect(() => createAccount({ ...valid, bookId: '' })).toThrow('book id');
	});

	it.each([1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
		'rejects non safe-integer opening balance %p',
		openingBalanceMinor => {
			expect(() => createAccount({ ...valid, openingBalanceMinor })).toThrow('safe integer');
		}
	);
});

describe('deriveAccountBalances', () => {
	it('layers statuses on top of the opening balance', () => {
		const balances = deriveAccountBalances(100, { cleared: -30, reconciled: 10, uncleared: -5 }, usd);

		expect(balances.reconciled.minorUnits).toBe(110);
		expect(balances.posted.minorUnits).toBe(80);
		expect(balances.total.minorUnits).toBe(75);
	});

	it('fails instead of losing precision on overflow', () => {
		expect(() =>
			deriveAccountBalances(Number.MAX_SAFE_INTEGER, { cleared: 0, reconciled: 1, uncleared: 0 }, usd)
		).toThrow('safe integer');
	});
});
