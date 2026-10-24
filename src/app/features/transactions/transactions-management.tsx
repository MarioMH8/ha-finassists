import type { ReactElement } from 'react';

import { MonthSummary, TransactionForm, TransactionList } from './components';
import { useTransactions } from './use-transactions.hook';

interface TransactionsManagementProps {
	currencyCode: string;
}

function TransactionsManagement({ currencyCode }: TransactionsManagementProps): ReactElement {
	const state = useTransactions(currencyCode);

	return (
		<>
			<TransactionForm {...state} />
			<MonthSummary {...state} />
			<TransactionList {...state} />
		</>
	);
}

export { TransactionsManagement };
