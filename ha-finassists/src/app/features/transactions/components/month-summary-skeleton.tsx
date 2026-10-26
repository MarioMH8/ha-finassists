import { LoadingStatus, Skeleton } from '@app/components/skeleton';
import type { Copy } from '@app/i18n';
import type { ReactElement } from 'react';

import styles from './month-summary.module.css';

const SKELETON_METRICS = ['income', 'expense', 'net'] as const;

interface MonthSummarySkeletonProps {
	copy: Copy;
}

function MonthSummarySkeleton({ copy }: MonthSummarySkeletonProps): ReactElement {
	return (
		<>
			<LoadingStatus label={copy.monthSummaryLoading} />
			<div
				aria-hidden='true'
				className={styles.kpis}>
				{SKELETON_METRICS.map(metric => (
					<div
						className={styles.kpi}
						key={metric}>
						<Skeleton className={styles.labelSkeleton} />
						<Skeleton className={styles.valueSkeleton} />
						<Skeleton className={styles.deltaSkeleton} />
					</div>
				))}
			</div>
		</>
	);
}

export { MonthSummarySkeleton };
