import { Notice, NOTICE_TONE } from '@app/components/notice';
import type { ReactElement } from 'react';

import { ScheduledPendingList } from './components/scheduled-pending-list';
import { ScheduledSummary } from './components/scheduled-summary';
import { ScheduledTransactionForm } from './components/scheduled-transaction-form';
import { ScheduledTransactionList } from './components/scheduled-transaction-list';
import { useScheduledTransactions } from './use-scheduled-transactions.hook';

interface ScheduledTransactionsManagementProps {
	currencyCode: string;
}

function ScheduledTransactionsManagement({ currencyCode }: ScheduledTransactionsManagementProps): ReactElement {
	const state = useScheduledTransactions(currencyCode);

	return (
		<>
			{state.feedback && !state.isEditorOpen ? (
				<Notice tone={state.feedback.tone === 'error' ? NOTICE_TONE.ERROR : NOTICE_TONE.SUCCESS}>
					{state.feedback.message}
				</Notice>
			) : undefined}
			<ScheduledSummary {...state} />
			<ScheduledPendingList {...state} />
			<ScheduledTransactionList {...state} />
			<ScheduledTransactionForm {...state} />
		</>
	);
}

export { ScheduledTransactionsManagement };
