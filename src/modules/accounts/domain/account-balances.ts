import type { Currency } from '@modules/money/domain';
import { Money } from '@modules/money/domain';

interface TransactionTotals {
	cleared: number;
	reconciled: number;
	uncleared: number;
}

interface AccountBalances {
	posted: Money;
	reconciled: Money;
	total: Money;
}

function deriveAccountBalances(
	openingBalanceMinor: number,
	totals: TransactionTotals,
	currency: Currency
): AccountBalances {
	const opening = Money.fromMinor(openingBalanceMinor, currency);
	const reconciled = opening.add(Money.fromMinor(totals.reconciled, currency));
	const posted = reconciled.add(Money.fromMinor(totals.cleared, currency));
	const total = posted.add(Money.fromMinor(totals.uncleared, currency));

	return { posted, reconciled, total };
}

export { type AccountBalances, deriveAccountBalances, type TransactionTotals };
