import type { Copy } from '@app/i18n';
import type { Language } from '@app/i18n/language';
import type { ReactElement } from 'react';

import { currencyFractionDigits, formatMinorUnits } from '../transaction-amount';
import type { MonthlyTransactionSummary } from '../transaction-summary';
import styles from './monthly-flow-chart.module.css';

interface MonthlyFlowChartProps {
	copy: Pick<Copy, 'monthSummaryChartAria' | 'monthSummaryExpenses' | 'monthSummaryIncome'>;
	currencyCode: string;
	language: Language;
	months: MonthlyTransactionSummary[];
}

const WIDTH = 640;
const HEIGHT = 236;
const MARGIN = { bottom: 30, left: 58, right: 10, top: 12 };
const TICKS = [0, 0.25, 0.5, 0.75, 1] as const;

function compactMinorUnits(value: number, currencyCode: string, language: Language): string {
	const digits = currencyFractionDigits(currencyCode);

	return new Intl.NumberFormat(language, {
		currency: currencyCode,
		maximumFractionDigits: 1,
		minimumFractionDigits: 0,
		notation: 'compact',
		style: 'currency',
	}).format(value / 10 ** digits);
}

function niceStep(value: number): number {
	if (value <= 0) {
		return 1;
	}
	const magnitude = 10 ** Math.floor(Math.log10(value));
	const normalized = value / magnitude;
	const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;

	return nice * magnitude;
}

function niceMax(value: number): number {
	if (value <= 0) {
		return 1;
	}
	const step = niceStep(value / 4);

	return Math.ceil(value / step) * step;
}

function MonthlyFlowChart({ copy, currencyCode, language, months }: MonthlyFlowChartProps): ReactElement {
	const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
	const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
	const maxValue = niceMax(Math.max(0, ...months.flatMap(month => [month.incomeMinor, month.expenseMinor])));
	const groupWidth = plotWidth / months.length;
	const barWidth = Math.min(18, Math.max(5, groupWidth * 0.26));

	return (
		<figure className={styles.chart}>
			<div
				aria-hidden='true'
				className={styles.legend}>
				<span className={styles.legendItem}>
					<span className={styles.incomeSwatch} />
					{copy.monthSummaryIncome}
				</span>
				<span className={styles.legendItem}>
					<span className={styles.expenseSwatch} />
					{copy.monthSummaryExpenses}
				</span>
			</div>
			<svg
				aria-label={copy.monthSummaryChartAria}
				role='img'
				viewBox={`0 0 ${String(WIDTH)} ${String(HEIGHT)}`}>
				{TICKS.map(tick => {
					const value = maxValue * tick;
					const y = MARGIN.top + plotHeight - tick * plotHeight;

					return (
						<g key={tick}>
							<line
								className={styles.gridLine}
								x1={MARGIN.left}
								x2={WIDTH - MARGIN.right}
								y1={y}
								y2={y}
							/>
							<text
								className={styles.axisLabel}
								textAnchor='end'
								x={MARGIN.left - 8}
								y={y + 4}>
								{compactMinorUnits(value, currencyCode, language)}
							</text>
						</g>
					);
				})}
				{months.map((month, index) => {
					const center = MARGIN.left + groupWidth * index + groupWidth / 2;
					const incomeHeight = (month.incomeMinor / maxValue) * plotHeight;
					const expenseHeight = (month.expenseMinor / maxValue) * plotHeight;
					const baseY = MARGIN.top + plotHeight;

					return (
						<g key={month.key}>
							<rect
								className={styles.incomeBar}
								height={incomeHeight}
								rx={3}
								width={barWidth}
								x={center - barWidth - 1}
								y={baseY - incomeHeight}>
								<title>
									{`${month.label}: ${copy.monthSummaryIncome} ${formatMinorUnits(
										month.incomeMinor,
										currencyCode,
										language
									)}`}
								</title>
							</rect>
							<rect
								className={styles.expenseBar}
								height={expenseHeight}
								rx={3}
								width={barWidth}
								x={center + 1}
								y={baseY - expenseHeight}>
								<title>
									{`${month.label}: ${copy.monthSummaryExpenses} ${formatMinorUnits(
										month.expenseMinor,
										currencyCode,
										language
									)}`}
								</title>
							</rect>
							<text
								className={styles.axisLabel}
								textAnchor='middle'
								x={center}
								y={HEIGHT - MARGIN.bottom + 18}>
								{month.label}
							</text>
						</g>
					);
				})}
			</svg>
			<table className={styles.srOnly}>
				<caption>{copy.monthSummaryChartAria}</caption>
				<thead>
					<tr>
						<th scope='col'>{copy.monthSummaryIncome}</th>
						<th scope='col'>{copy.monthSummaryExpenses}</th>
					</tr>
				</thead>
				<tbody>
					{months.map(month => (
						<tr key={month.key}>
							<th scope='row'>{month.label}</th>
							<td>{formatMinorUnits(month.incomeMinor, currencyCode, language)}</td>
							<td>{formatMinorUnits(month.expenseMinor, currencyCode, language)}</td>
						</tr>
					))}
				</tbody>
			</table>
		</figure>
	);
}

export { MonthlyFlowChart };
