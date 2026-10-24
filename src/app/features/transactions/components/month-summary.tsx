import { Button, BUTTON_APPEARANCE, BUTTON_SIZE } from '@app/components/button';
import { Card } from '@app/components/card';
import { classNames } from '@app/components/class-names';
import { Icon, ICON_NAME } from '@app/components/icon';
import { Notice, NOTICE_TONE } from '@app/components/notice';
import { SectionHeading } from '@app/components/section-heading';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { formatMinorUnits } from '../transaction-amount';
import { LOAD_STATE } from '../transactions-constants';
import type { TransactionsState } from '../use-transactions.hook';
import styles from './month-summary.module.css';
import { MonthlyFlowChart } from './monthly-flow-chart';

type MonthSummaryProps = Pick<TransactionsState, 'copy' | 'currencyCode' | 'language' | 'summary' | 'summaryState'>;

const DELTA_TONE = {
	BAD: 'bad',
	GOOD: 'good',
	NEUTRAL: 'neutral',
} as const;

type DeltaTone = (typeof DELTA_TONE)[keyof typeof DELTA_TONE];

function deltaTone(delta: number, isHigherBetter: boolean): DeltaTone {
	if (delta === 0) {
		return DELTA_TONE.NEUTRAL;
	}
	const isPositive = delta > 0;

	return isPositive === isHigherBetter ? DELTA_TONE.GOOD : DELTA_TONE.BAD;
}

function deltaArrow(delta: number): string {
	if (delta === 0) {
		return '→';
	}

	return delta > 0 ? '↑' : '↓';
}

function MonthSummary({ copy, currencyCode, language, summary, summaryState }: MonthSummaryProps): ReactElement {
	const [isChartOpen, setIsChartOpen] = useState(false);
	const metrics = summary
		? [
				{
					delta: summary.incomeMinor - summary.previous.incomeMinor,
					isHigherBetter: true,
					key: 'income',
					label: copy.monthSummaryIncome,
					signDisplay: false,
					tone: styles.income,
					value: summary.incomeMinor,
				},
				{
					delta: summary.expenseMinor - summary.previous.expenseMinor,
					isHigherBetter: false,
					key: 'expense',
					label: copy.monthSummaryExpenses,
					signDisplay: false,
					tone: styles.expense,
					value: summary.expenseMinor,
				},
				{
					delta: summary.netMinor - summary.previous.netMinor,
					isHigherBetter: true,
					key: 'net',
					label: copy.monthSummaryNet,
					signDisplay: true,
					tone: styles.net,
					value: summary.netMinor,
				},
			]
		: [];

	const chartToggle = (
		<Button
			appearance={BUTTON_APPEARANCE.PLAIN}
			aria-controls='month-summary-chart'
			aria-expanded={isChartOpen}
			aria-label={isChartOpen ? copy.monthSummaryHideChart : copy.monthSummaryShowChart}
			onClick={() => {
				setIsChartOpen(current => !current);
			}}
			size={BUTTON_SIZE.SMALL}
			title={isChartOpen ? copy.monthSummaryHideChart : copy.monthSummaryShowChart}
			type='button'>
			<Icon name={ICON_NAME.CHART} />
		</Button>
	);

	return (
		<Card
			aria-labelledby='month-summary-title'
			className={styles.card}>
			<SectionHeading
				actions={chartToggle}
				description={copy.monthSummaryDescription}
				level={3}
				title={copy.monthSummaryTitle}
				titleId='month-summary-title'
			/>
			{summaryState === LOAD_STATE.ERROR ? (
				<Notice tone={NOTICE_TONE.ERROR}>{copy.monthSummaryError}</Notice>
			) : !summary && summaryState === LOAD_STATE.LOADING ? (
				<Notice>{copy.monthSummaryLoading}</Notice>
			) : summary ? (
				<>
					<dl className={styles.kpis}>
						{metrics.map(metric => {
							const tone = deltaTone(metric.delta, metric.isHigherBetter);

							return (
								<div
									className={classNames(styles.kpi, metric.key === 'net' && styles.kpiNet)}
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
									<dd
										className={classNames(
											styles.delta,
											tone === DELTA_TONE.GOOD && styles.deltaGood,
											tone === DELTA_TONE.BAD && styles.deltaBad
										)}>
										{metric.delta === 0 ? (
											<span>{copy.monthSummaryNoChange}</span>
										) : (
											<>
												<span aria-hidden='true'>{deltaArrow(metric.delta)}</span>
												{formatMinorUnits(metric.delta, currencyCode, language, 'exceptZero')}
											</>
										)}
										<span className={styles.previous}>{copy.monthSummaryVsPrevious}</span>
									</dd>
								</div>
							);
						})}
					</dl>
					<section
						aria-labelledby='month-summary-chart-title'
						className={styles.chartSection}
						hidden={!isChartOpen}
						id='month-summary-chart'>
						<div className={styles.chartHeading}>
							<h4 id='month-summary-chart-title'>{copy.monthSummaryChartTitle}</h4>
							<p>{copy.monthSummaryChartDescription}</p>
						</div>
						<MonthlyFlowChart
							copy={copy}
							currencyCode={currencyCode}
							language={language}
							months={summary.months}
						/>
					</section>
				</>
			) : (
				<Notice>{copy.monthSummaryLoading}</Notice>
			)}
		</Card>
	);
}

export { MonthSummary };
