import { Badge, BADGE_TONE } from '@app/components/badge';
import { Button } from '@app/components/button';
import { Card } from '@app/components/card';
import { classNames } from '@app/components/class-names';
import { DataCell, DataTable } from '@app/components/data-table';
import { EmptyState } from '@app/components/empty-state';
import { Notice, NOTICE_TONE } from '@app/components/notice';
import { SectionHeading } from '@app/components/section-heading';
import { interpolate } from '@app/i18n';
import type { ReactElement } from 'react';

import { formatDate, formatMinorUnits } from '../transaction-amount';
import { TRANSACTION_KIND } from '../transactions-api';
import type { TransactionsState } from '../use-transactions.hook';
import { LOAD_STATE } from '../use-transactions.hook';
import styles from './transaction-list.module.css';

type TransactionListProps = Pick<
	TransactionsState,
	'copy' | 'hasMore' | 'isLoadingMore' | 'language' | 'listState' | 'loadMore' | 'refresh' | 'total' | 'transactions'
>;

function TransactionList({
	copy,
	hasMore,
	isLoadingMore,
	language,
	listState,
	loadMore,
	refresh,
	total,
	transactions,
}: TransactionListProps): ReactElement {
	const refreshAction = (
		<Button
			onClick={() => void refresh()}
			type='button'>
			{copy.refresh}
		</Button>
	);

	return (
		<Card aria-labelledby='transaction-list-title'>
			<SectionHeading
				actions={refreshAction}
				description={copy.transactionListDescription}
				title={copy.transactionListTitle}
				titleId='transaction-list-title'
			/>
			<div className={styles.content}>
				{listState === LOAD_STATE.ERROR ? (
					<Notice tone={NOTICE_TONE.ERROR}>{copy.transactionLoadError}</Notice>
				) : listState === LOAD_STATE.LOADING && transactions.length === 0 ? (
					<Notice>{copy.transactionLoading}</Notice>
				) : transactions.length === 0 ? (
					<EmptyState title={copy.transactionEmptyTitle}>{copy.transactionEmptyDescription}</EmptyState>
				) : (
					<>
						<DataTable>
							<thead>
								<tr>
									<th>{copy.transactionColumnDate}</th>
									<th>{copy.transactionColumnDescription}</th>
									<th>{copy.transactionColumnKind}</th>
									<th className={styles.amountHeading}>{copy.transactionColumnAmount}</th>
								</tr>
							</thead>
							<tbody>
								{transactions.map(transaction => {
									const isIncome = transaction.kind === TRANSACTION_KIND.INCOME;
									const signedMinor = isIncome ? transaction.amountMinor : -transaction.amountMinor;

									return (
										<tr key={transaction.id}>
											<DataCell className={styles.date}>
												<time dateTime={transaction.transactionDate}>
													{formatDate(transaction.transactionDate, language)}
												</time>
											</DataCell>
											<DataCell>
												{transaction.description || (
													<span className={styles.muted}>
														{copy.transactionNoDescription}
													</span>
												)}
											</DataCell>
											<DataCell>
												<Badge tone={isIncome ? BADGE_TONE.SUCCESS : BADGE_TONE.DANGER}>
													{isIncome
														? copy.transactionKindIncome
														: copy.transactionKindExpense}
												</Badge>
											</DataCell>
											<DataCell
												className={classNames(isIncome ? styles.income : styles.expense)}
												numeric>
												{formatMinorUnits(
													signedMinor,
													transaction.currencyCode,
													language,
													'exceptZero'
												)}
											</DataCell>
										</tr>
									);
								})}
							</tbody>
						</DataTable>
						<div className={styles.footer}>
							<p className={styles.count}>
								{interpolate(copy.transactionShowing, { shown: transactions.length, total })}
							</p>
							{hasMore && (
								<Button
									aria-busy={isLoadingMore}
									disabled={isLoadingMore}
									onClick={() => void loadMore()}
									type='button'>
									{isLoadingMore ? copy.transactionLoadingMore : copy.transactionLoadMore}
								</Button>
							)}
						</div>
					</>
				)}
			</div>
		</Card>
	);
}

export { TransactionList };
