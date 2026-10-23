import { Currency } from '@modules/money/domain';
import { describe, expect, it } from 'bun:test';

import {
	Account,
	AccountAlreadyClosedError,
	AccountBalanceOutOfRangeError,
	AccountBookIdInvalidError,
	AccountIdInvalidError,
	AccountKindInvalidError,
	AccountNameInvalidError,
	AccountNotClosedError,
	AccountOpeningBalanceInvalidError,
} from '.';
import { AccountMother } from './account.mother';

const OPEN_ACCOUNT = JSON.parse('null') as null;
const usd = Currency.create('USD');

describe('Account', () => {
	it('should create a normalized account and preserve negative opening balances', () => {
		const account = AccountMother.create({ name: '  Card  ', openingBalanceMinor: -2500 });

		expect(account).toBeInstanceOf(Account);
		expect(account).toMatchObject({ closedAt: OPEN_ACCOUNT, name: 'Card', openingBalanceMinor: -2500 });
		expect(Number.isNaN(Date.parse(account.createdAt))).toBe(false);
	});

	it('should close immutably and reject closing an already closed account', () => {
		const account = AccountMother.create();
		const closed = account.close('2026-06-01T00:00:00.000Z');

		expect(account.closedAt).toBeNull();
		expect(closed.closedAt).toBe('2026-06-01T00:00:00.000Z');
		expect(() => closed.close('2026-06-02T00:00:00.000Z')).toThrow(AccountAlreadyClosedError);
	});

	it('should reopen a closed account immutably and reject reopening an open account', () => {
		const account = AccountMother.create().close('2026-06-01T00:00:00.000Z');
		const reopened = account.reopen();

		expect(account.closedAt).toBe('2026-06-01T00:00:00.000Z');
		expect(reopened.closedAt).toBeNull();
		expect(() => reopened.reopen()).toThrow(AccountNotClosedError);
	});

	it.each([' ', 'x'.repeat(81)])('should reject invalid names', name => {
		expect(() => AccountMother.create({ name })).toThrow(AccountNameInvalidError);
	});

	it('should reject invalid identifiers and kinds', () => {
		expect(() => AccountMother.create({ id: ' ' })).toThrow(AccountIdInvalidError);
		expect(() => AccountMother.create({ bookId: ' ' })).toThrow(AccountBookIdInvalidError);
		expect(() => AccountMother.create({ kind: 'crypto' })).toThrow(AccountKindInvalidError);
	});

	it.each([1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
		'should reject unsafe opening balance %p',
		openingBalanceMinor => {
			expect(() => AccountMother.create({ openingBalanceMinor })).toThrow(AccountOpeningBalanceInvalidError);
		}
	);

	it('should derive balance layers from transaction totals', () => {
		const balances = AccountMother.create({ openingBalanceMinor: 100 }).balances(
			{ cleared: -30, reconciled: 10, uncleared: -5 },
			usd
		);

		expect(balances.reconciled.minorUnits).toBe(110);
		expect(balances.posted.minorUnits).toBe(80);
		expect(balances.total.minorUnits).toBe(75);
	});

	it('should reject balance calculations that exceed the safe integer range', () => {
		expect(() =>
			AccountMother.create({ openingBalanceMinor: Number.MAX_SAFE_INTEGER }).balances(
				{ cleared: 0, reconciled: 1, uncleared: 0 },
				usd
			)
		).toThrow(AccountBalanceOutOfRangeError);
	});

	it('should reject unsafe transaction totals before combining them with the opening balance', () => {
		expect(() =>
			AccountMother.create({ openingBalanceMinor: -Number.MAX_SAFE_INTEGER }).balances(
				{ cleared: 0, reconciled: Number.MAX_SAFE_INTEGER + 1, uncleared: 0 },
				usd
			)
		).toThrow(AccountBalanceOutOfRangeError);
	});
});
