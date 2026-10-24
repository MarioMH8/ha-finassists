import { Card } from '@app/components/card';
import { classNames } from '@app/components/class-names';
import { Notice, NOTICE_TONE } from '@app/components/notice';
import { SectionHeading } from '@app/components/section-heading';
import type { ReactElement } from 'react';

import { formatMinorUnits } from '../transaction-amount';
import type { TransactionsState } from '../use-transactions.hook';
import { LOAD_STATE } from '../use-transactions.hook';
import styles from './month-summary.module.css';

type MonthSummaryProps = Pick<TransactionsState, 'copy' | 'currencyCode' | 'language' | 'summaryState' | 'totals'>;

function MonthSummary({ copy, currencyCode, language, summaryState, totals }: MonthSummaryProps): ReactElement {
	return (
		<Card aria-labelledby='month-summary-title'>
			<SectionHeading
				level={3}
				title={copy.monthSummaryTitle}
				titleId='month-summary-title'
			/>
			{summaryState === LOAD_STATE.ERROR ? (
				<Notice tone={NOTICE_TONE.ERROR}>{copy.monthSummaryError}</Notice>
			) : totals ? (
				<dl className={styles.totals}>
					<div className={styles.total}>
						<dt className={styles.label}>{copy.monthSummaryIncome}</dt>
						<dd className={classNames(styles.value, styles.income)}>
							{formatMinorUnits(totals.incomeMinor, currencyCode, language)}
						</dd>
					</div>
					<div className={styles.total}>
						<dt className={styles.label}>{copy.monthSummaryExpenses}</dt>
						<dd className={classNames(styles.value, styles.expense)}>
							{formatMinorUnits(totals.expenseMinor, currencyCode, language)}
						</dd>
					</div>
					<div className={styles.total}>
						<dt className={styles.label}>{copy.monthSummaryNet}</dt>
						<dd className={styles.value}>
							{formatMinorUnits(totals.netMinor, currencyCode, language, 'exceptZero')}
						</dd>
					</div>
				</dl>
			) : (
				<Notice>{copy.monthSummaryLoading}</Notice>
			)}
		</Card>
	);
}

export { MonthSummary };
