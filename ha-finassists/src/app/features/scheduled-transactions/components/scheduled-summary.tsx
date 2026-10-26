import { Card } from '@app/components/card';
import { classNames } from '@app/components/class-names';
import { Notice, NOTICE_TONE } from '@app/components/notice';
import { SectionHeading } from '@app/components/section-heading';
import type { ScheduledTransactionsState } from '@app/features/scheduled-transactions/use-scheduled-transactions.hook';
import { formatDate, formatMinorUnits } from '@app/features/transactions/transaction-amount';
import { LOAD_STATE } from '@app/features/transactions/transactions-constants';
import { interpolate } from '@app/i18n';
import type { ReactElement } from 'react';

import styles from './scheduled-summary.module.css';
import { ScheduledSummarySkeleton } from './scheduled-summary-skeleton';

type ScheduledSummaryProps = Pick<
	ScheduledTransactionsState,
	'copy' | 'currencyCode' | 'forecast' | 'forecastState' | 'language' | 'pendingSchedules'
>;

function ScheduledSummary({
	copy,
	currencyCode,
	forecast,
	forecastState,
	language,
	pendingSchedules,
}: ScheduledSummaryProps): ReactElement {
	const metrics = forecast
		? [
				{
					key: 'income',
					label: copy.scheduledSummaryIncome,
					signDisplay: false,
					tone: styles.income,
					value: forecast.totals.incomeMinor,
				},
				{
					key: 'expense',
					label: copy.scheduledSummaryExpenses,
					signDisplay: false,
					tone: styles.expense,
					value: forecast.totals.expenseMinor,
				},
				{
					key: 'net',
					label: copy.scheduledSummaryNet,
					signDisplay: true,
					tone: styles.net,
					value: forecast.totals.netMinor,
				},
			]
		: [];

	return (
		<Card
			aria-labelledby='scheduled-summary-title'
			className={styles.card}>
			<SectionHeading
				description={copy.scheduledSummaryDescription}
				level={3}
				title={copy.scheduledSummaryTitle}
				titleId='scheduled-summary-title'
			/>
			{forecastState === LOAD_STATE.ERROR ? (
				<Notice tone={NOTICE_TONE.ERROR}>{copy.scheduledSummaryError}</Notice>
			) : forecast ? (
				<>
					<dl className={styles.kpis}>
						{metrics.map(metric => (
							<div
								className={styles.kpi}
								key={metric.key}>
								<dt className={styles.label}>
									<span
										aria-hidden='true'
										className={classNames(styles.swatch, metric.tone)}
									/>
									{metric.label}
								</dt>
								<dd className={styles.value}>
									{formatMinorUnits(
										metric.value,
										currencyCode,
										language,
										metric.signDisplay ? 'exceptZero' : 'auto'
									)}
								</dd>
							</div>
						))}
					</dl>
					<p className={styles.range}>
						{interpolate(copy.scheduledSummaryRange, {
							from: formatDate(forecast.fromDate, language),
							to: formatDate(forecast.toDate, language),
						})}
					</p>
					{pendingSchedules.length > 0 ? (
						<Notice tone={NOTICE_TONE.WARNING}>
							{interpolate(copy.scheduledPendingNotice, { count: pendingSchedules.length })}
						</Notice>
					) : undefined}
				</>
			) : (
				<ScheduledSummarySkeleton copy={copy} />
			)}
		</Card>
	);
}

export { ScheduledSummary };
