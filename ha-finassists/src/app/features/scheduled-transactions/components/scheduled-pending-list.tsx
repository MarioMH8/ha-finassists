import { Badge, BADGE_TONE } from '@app/components/badge';
import { Button, BUTTON_APPEARANCE, BUTTON_SIZE, BUTTON_VARIANT } from '@app/components/button';
import { DATA_ALIGN, DataCell, DataHeaderCell, DataRowActions, DataTable } from '@app/components/data-table';
import { SectionHeading } from '@app/components/section-heading';
import type { ScheduledTransactionsState } from '@app/features/scheduled-transactions/use-scheduled-transactions.hook';
import { formatDate, formatMinorUnits } from '@app/features/transactions/transaction-amount';
import { TRANSACTION_KIND } from '@app/features/transactions/transactions-api';
import type { ReactElement } from 'react';

import styles from './scheduled-pending-list.module.css';

type ScheduledPendingListProps = Pick<
	ScheduledTransactionsState,
	| 'busyScheduleId'
	| 'copy'
	| 'currencyCode'
	| 'language'
	| 'pendingSchedules'
	| 'postSchedule'
	| 'skipSchedule'
	| 'today'
>;

function ScheduledPendingList({
	busyScheduleId,
	copy,
	currencyCode,
	language,
	pendingSchedules,
	postSchedule,
	skipSchedule,
	today,
}: ScheduledPendingListProps): ReactElement {
	if (pendingSchedules.length === 0) {
		return <></>;
	}

	return (
		<section
			aria-labelledby='scheduled-pending-title'
			className={styles.section}>
			<SectionHeading
				description={copy.scheduledPendingDescription}
				title={copy.scheduledPendingTitle}
				titleId='scheduled-pending-title'
			/>
			<DataTable>
				<thead>
					<tr>
						<DataHeaderCell>{copy.scheduledColumnNextDate}</DataHeaderCell>
						<DataHeaderCell>{copy.scheduledColumnDescription}</DataHeaderCell>
						<DataHeaderCell align={DATA_ALIGN.END}>{copy.scheduledColumnAmount}</DataHeaderCell>
						<DataHeaderCell align={DATA_ALIGN.END}>{copy.scheduledColumnActions}</DataHeaderCell>
					</tr>
				</thead>
				<tbody>
					{pendingSchedules.map(schedule => {
						const isBusy = busyScheduleId === schedule.id;
						const isOverdue = schedule.nextDueDate !== null && schedule.nextDueDate < today;
						const signedMinor =
							schedule.kind === TRANSACTION_KIND.INCOME ? schedule.amountMinor : -schedule.amountMinor;

						return (
							<tr key={schedule.id}>
								<DataCell className={styles.date}>
									{schedule.nextDueDate === null ? undefined : (
										<time dateTime={schedule.nextDueDate}>
											{formatDate(schedule.nextDueDate, language)}
										</time>
									)}
									<Badge tone={isOverdue ? BADGE_TONE.DANGER : BADGE_TONE.WARNING}>
										{isOverdue ? copy.scheduledOverdue : copy.scheduledDueToday}
									</Badge>
								</DataCell>
								<DataCell>{schedule.description || copy.transactionNoDescription}</DataCell>
								<DataCell
									className={
										schedule.kind === TRANSACTION_KIND.INCOME ? styles.income : styles.expense
									}
									numeric>
									{formatMinorUnits(signedMinor, currencyCode, language, 'exceptZero')}
								</DataCell>
								<DataCell
									align={DATA_ALIGN.END}
									className={styles.actions}>
									<DataRowActions>
										<Button
											appearance={BUTTON_APPEARANCE.ACCENT}
											aria-busy={isBusy}
											disabled={isBusy}
											onClick={() => void postSchedule(schedule)}
											size={BUTTON_SIZE.SMALL}
											type='button'
											variant={BUTTON_VARIANT.BRAND}>
											{copy.scheduledPost}
										</Button>
										<Button
											appearance={BUTTON_APPEARANCE.PLAIN}
											disabled={isBusy}
											onClick={() => void skipSchedule(schedule)}
											size={BUTTON_SIZE.SMALL}
											type='button'>
											{copy.scheduledSkip}
										</Button>
									</DataRowActions>
								</DataCell>
							</tr>
						);
					})}
				</tbody>
			</DataTable>
		</section>
	);
}

export { ScheduledPendingList };
