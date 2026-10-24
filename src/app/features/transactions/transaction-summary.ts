import type { Language } from '@app/i18n/language';

import type { Transaction, TransactionTotals } from './transactions-api';
import { TRANSACTION_KIND } from './transactions-api';

const SUMMARY_MONTHS = 6;

type SummaryTransaction = Pick<Transaction, 'amountMinor' | 'currencyCode' | 'kind' | 'transactionDate'>;

interface MonthlyTransactionSummary extends TransactionTotals {
	key: string;
	label: string;
}

interface TransactionSummary extends TransactionTotals {
	months: MonthlyTransactionSummary[];
	previous: TransactionTotals;
}

const EMPTY_TOTALS: TransactionTotals = { expenseMinor: 0, incomeMinor: 0, netMinor: 0 };

function monthKey(date: Date): string {
	return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date: Date, language: Language): string {
	return new Intl.DateTimeFormat(language, { month: 'short' }).format(date);
}

function buildTransactionSummary(
	transactions: readonly SummaryTransaction[],
	currencyCode: string,
	language: Language,
	now: Date = new Date()
): TransactionSummary {
	const months: MonthlyTransactionSummary[] = [];
	for (let index = SUMMARY_MONTHS - 1; index >= 0; index -= 1) {
		const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
		months.push({
			...EMPTY_TOTALS,
			key: monthKey(date),
			label: monthLabel(date, language),
		});
	}
	const byMonth = new Map(months.map(month => [month.key, month]));

	for (const transaction of transactions) {
		if (transaction.currencyCode !== currencyCode) {
			continue;
		}
		const month = byMonth.get(transaction.transactionDate.slice(0, 7));
		if (month === undefined) {
			continue;
		}
		if (transaction.kind === TRANSACTION_KIND.INCOME) {
			month.incomeMinor += transaction.amountMinor;
		} else {
			month.expenseMinor += transaction.amountMinor;
		}
	}
	for (const month of months) {
		month.netMinor = month.incomeMinor - month.expenseMinor;
	}

	const current = months.at(-1) ?? { ...EMPTY_TOTALS, key: '', label: '' };
	const previous = months.at(-2) ?? { ...EMPTY_TOTALS, key: '', label: '' };

	return {
		expenseMinor: current.expenseMinor,
		incomeMinor: current.incomeMinor,
		months,
		netMinor: current.netMinor,
		previous: {
			expenseMinor: previous.expenseMinor,
			incomeMinor: previous.incomeMinor,
			netMinor: previous.netMinor,
		},
	};
}

export {
	buildTransactionSummary,
	type MonthlyTransactionSummary,
	SUMMARY_MONTHS,
	type SummaryTransaction,
	type TransactionSummary,
};
