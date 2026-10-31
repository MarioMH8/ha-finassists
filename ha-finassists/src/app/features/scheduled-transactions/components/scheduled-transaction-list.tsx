import { Badge, BADGE_TONE } from '@app/components/badge';
import { Button, BUTTON_APPEARANCE, BUTTON_VARIANT } from '@app/components/button';
import { Card } from '@app/components/card';
import { DATA_ALIGN, DataCell, DataHeaderCell, DataRowActions, DataTable } from '@app/components/data-table';
import { Dialog, DIALOG_TYPE } from '@app/components/dialog';
import { EmptyState } from '@app/components/empty-state';
import { ICON_NAME } from '@app/components/icon';
import { Menu, MENU_ITEM_TONE } from '@app/components/menu';
import { Notice, NOTICE_TONE } from '@app/components/notice';
import { SectionHeading } from '@app/components/section-heading';
import { recurrenceLabel } from '@app/features/scheduled-transactions/scheduled-transaction-recurrence';
import type { ScheduledTransactionsState } from '@app/features/scheduled-transactions/use-scheduled-transactions.hook';
import { formatDate, formatMinorUnits } from '@app/features/transactions/transaction-amount';
import { TRANSACTION_KIND } from '@app/features/transactions/transactions-api';
import { LOAD_STATE } from '@app/features/transactions/transactions-constants';
import { interpolate } from '@app/i18n';
import { useFeatureFlags } from '@app/shell/feature-flags-context';
import type { ReactElement } from 'react';

import styles from './scheduled-transaction-list.module.css';
import { ScheduledTransactionListSkeleton } from './scheduled-transaction-list-skeleton';

type ScheduledTransactionListProps = Pick<
	ScheduledTransactionsState,
	| 'busyScheduleId'
	| 'cancelDelete'
	| 'categories'
	| 'confirmingScheduleId'
	| 'copy'
	| 'currencyCode'
	| 'deleteSchedule'
	| 'deletingScheduleId'
	| 'language'
	| 'listState'
	| 'openCreate'
	| 'openEdit'
	| 'pauseSchedule'
	| 'resumeSchedule'
	| 'schedules'
	| 'setConfirmingScheduleId'
	| 'today'
>;

function ScheduledTransactionList({
	busyScheduleId,
	cancelDelete,
	categories,
	confirmingScheduleId,
	copy,
	currencyCode,
	deleteSchedule,
	deletingScheduleId,
	language,
	listState,
	openCreate,
	openEdit,
	pauseSchedule,
	resumeSchedule,
	schedules,
	setConfirmingScheduleId,
	today,
}: ScheduledTransactionListProps): ReactElement {
	const { capabilities } = useFeatureFlags();
	const categoryNames = new Map(categories.map(category => [category.id, category.name]));
	const pendingDelete = schedules.find(schedule => schedule.id === confirmingScheduleId);
	const isDeleting = deletingScheduleId === pendingDelete?.id;
	const newScheduleAction = (
		<Button
			appearance={BUTTON_APPEARANCE.ACCENT}
			onClick={openCreate}
			type='button'
			variant={BUTTON_VARIANT.BRAND}>
			{copy.scheduledCreate}
		</Button>
	);
	const confirmationFooter = (
		<>
			<Button
				onClick={cancelDelete}
				type='button'>
				{copy.cancel}
			</Button>
			<Button
				appearance={BUTTON_APPEARANCE.FILLED}
				aria-busy={isDeleting}
				disabled={isDeleting}
				onClick={() => {
					if (pendingDelete) {
						void deleteSchedule(pendingDelete);
					}
				}}
				type='button'
				variant={BUTTON_VARIANT.DANGER}>
				{isDeleting ? copy.scheduledDeleting : copy.scheduledDelete}
			</Button>
		</>
	);

	const tableHead = (
		<thead>
			<tr>
				<DataHeaderCell>{copy.scheduledColumnNextDate}</DataHeaderCell>
				<DataHeaderCell>{copy.scheduledColumnDescription}</DataHeaderCell>
				{capabilities.categories ? <DataHeaderCell>{copy.scheduledColumnCategory}</DataHeaderCell> : undefined}
				<DataHeaderCell>{copy.scheduledColumnRecurrence}</DataHeaderCell>
				<DataHeaderCell align={DATA_ALIGN.END}>{copy.scheduledColumnAmount}</DataHeaderCell>
				<DataHeaderCell>{copy.scheduledColumnStatus}</DataHeaderCell>
				<DataHeaderCell align={DATA_ALIGN.END}>{copy.scheduledColumnActions}</DataHeaderCell>
			</tr>
		</thead>
	);

	return (
		<section
			aria-labelledby='scheduled-list-title'
			className={styles.section}>
			<SectionHeading
				actions={newScheduleAction}
				description={copy.scheduledListDescription}
				title={copy.scheduledListTitle}
				titleId='scheduled-list-title'
			/>
			{listState === LOAD_STATE.ERROR ? (
				<Notice tone={NOTICE_TONE.ERROR}>{copy.scheduledLoadError}</Notice>
			) : listState === LOAD_STATE.LOADING && schedules.length === 0 ? (
				<ScheduledTransactionListSkeleton
					copy={copy}
					head={tableHead}
				/>
			) : schedules.length === 0 ? (
				<Card bleed>
					<EmptyState
						icon={ICON_NAME.CALENDAR}
						title={copy.scheduledEmptyTitle}>
						{copy.scheduledEmptyDescription}
					</EmptyState>
				</Card>
			) : (
				<DataTable aria-busy={listState === LOAD_STATE.LOADING || undefined}>
					{tableHead}
					<tbody>
						{schedules.map(schedule => {
							const isBusy = busyScheduleId === schedule.id;
							const isPaused = schedule.status === 'paused';
							const isPending =
								schedule.postingMode === 'manual' &&
								schedule.nextDueDate !== null &&
								schedule.nextDueDate <= today;
							const signedMinor =
								schedule.kind === TRANSACTION_KIND.INCOME
									? schedule.amountMinor
									: -schedule.amountMinor;
							const description = schedule.description || copy.transactionNoDescription;

							return (
								<tr key={schedule.id}>
									<DataCell className={styles.date}>
										{schedule.nextDueDate === null ? (
											<span className={styles.muted}>{copy.scheduledStatusCompleted}</span>
										) : (
											<time dateTime={schedule.nextDueDate}>
												{formatDate(schedule.nextDueDate, language)}
											</time>
										)}
									</DataCell>
									<DataCell>
										{schedule.description || (
											<span className={styles.muted}>{copy.transactionNoDescription}</span>
										)}
									</DataCell>
									{capabilities.categories ? (
										<DataCell>
											{schedule.categoryId === null ? (
												<span className={styles.muted}>{copy.transactionCategoryNone}</span>
											) : (
												(categoryNames.get(schedule.categoryId) ?? (
													<span className={styles.muted}>
														{copy.transactionCategoryUnknown}
													</span>
												))
											)}
										</DataCell>
									) : undefined}
									<DataCell>{recurrenceLabel(copy, schedule.frequency, schedule.interval)}</DataCell>
									<DataCell
										className={
											schedule.kind === TRANSACTION_KIND.INCOME ? styles.income : styles.expense
										}
										numeric>
										{formatMinorUnits(signedMinor, currencyCode, language, 'exceptZero')}
									</DataCell>
									<DataCell>
										<div className={styles.badges}>
											<Badge
												tone={isPaused || isPending ? BADGE_TONE.WARNING : BADGE_TONE.SUCCESS}>
												{isPaused
													? copy.scheduledStatusPaused
													: isPending
														? copy.scheduledDue
														: copy.scheduledStatusActive}
											</Badge>
											<Badge tone={BADGE_TONE.NEUTRAL}>
												{schedule.postingMode === 'automatic'
													? copy.scheduledModeAutomatic
													: copy.scheduledModeManual}
											</Badge>
										</div>
									</DataCell>
									<DataCell
										align={DATA_ALIGN.END}
										className={styles.actions}>
										<DataRowActions>
											<Menu
												items={[
													{
														disabled: isBusy,
														icon: ICON_NAME.EDIT,
														label: copy.scheduledEdit,
														onSelect: () => {
															openEdit(schedule);
														},
													},
													{
														disabled: isBusy,
														icon: isPaused ? ICON_NAME.PLAY : ICON_NAME.PAUSE,
														label: isPaused ? copy.scheduledResume : copy.scheduledPause,
														onSelect: () => {
															void (isPaused
																? resumeSchedule(schedule)
																: pauseSchedule(schedule));
														},
													},
													{
														disabled: isBusy,
														icon: ICON_NAME.DELETE,
														label: copy.scheduledDelete,
														onSelect: () => {
															setConfirmingScheduleId(schedule.id);
														},
														tone: MENU_ITEM_TONE.DANGER,
													},
												]}
												label={interpolate(copy.scheduledOptions, { description })}
											/>
										</DataRowActions>
									</DataCell>
								</tr>
							);
						})}
					</tbody>
				</DataTable>
			)}
			<Dialog
				closeLabel={copy.close}
				description={
					pendingDelete
						? interpolate(copy.scheduledDeletePrompt, {
								description: pendingDelete.description || copy.transactionNoDescription,
							})
						: undefined
				}
				footer={confirmationFooter}
				id='scheduled-delete-dialog'
				onClose={cancelDelete}
				open={pendingDelete !== undefined}
				title={copy.scheduledDeleteTitle}
				type={DIALOG_TYPE.ALERT}
			/>
		</section>
	);
}

export { ScheduledTransactionList };
