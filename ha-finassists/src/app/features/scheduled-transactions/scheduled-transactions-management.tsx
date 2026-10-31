import { Notice, NOTICE_TONE } from '@app/components/notice';
import { useFeatureFlags } from '@app/shell/feature-flags-context';
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
	const { ui } = useFeatureFlags();
	const state = useScheduledTransactions(currencyCode);

	return (
		<>
			{state.feedback && !state.isEditorOpen ? (
				<Notice tone={state.feedback.tone === 'error' ? NOTICE_TONE.ERROR : NOTICE_TONE.SUCCESS}>
					{state.feedback.message}
				</Notice>
			) : undefined}
			{ui.scheduledSummary ? <ScheduledSummary {...state} /> : undefined}
			{ui.scheduledPending ? <ScheduledPendingList {...state} /> : undefined}
			<ScheduledTransactionList {...state} />
			<ScheduledTransactionForm {...state} />
		</>
	);
}

export { ScheduledTransactionsManagement };
