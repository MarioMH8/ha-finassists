import { useFeatureFlags } from '@app/shell/feature-flags-context';
import type { ReactElement } from 'react';

import { MonthSummary, TransactionForm, TransactionList } from './components';
import { useTransactions } from './use-transactions.hook';

interface TransactionsManagementProps {
	currencyCode: string;
}

function TransactionsManagement({ currencyCode }: TransactionsManagementProps): ReactElement {
	const { ui } = useFeatureFlags();
	const state = useTransactions(currencyCode);

	return (
		<>
			{ui.monthSummary ? <MonthSummary {...state} /> : undefined}
			<TransactionList {...state} />
			<TransactionForm {...state} />
		</>
	);
}

export { TransactionsManagement };
