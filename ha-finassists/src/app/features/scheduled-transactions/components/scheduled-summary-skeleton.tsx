import { LoadingStatus, Skeleton } from '@app/components/skeleton';
import type { Copy } from '@app/i18n';
import type { ReactElement } from 'react';

import styles from './scheduled-summary.module.css';

const SKELETON_METRICS = ['income', 'expense', 'net'] as const;

interface ScheduledSummarySkeletonProps {
	copy: Copy;
}

function ScheduledSummarySkeleton({ copy }: ScheduledSummarySkeletonProps): ReactElement {
	return (
		<>
			<LoadingStatus label={copy.scheduledSummaryLoading} />
			<div
				aria-hidden='true'
				className={styles.kpis}>
				{SKELETON_METRICS.map(metric => (
					<div
						className={styles.kpi}
						key={metric}>
						<Skeleton className={styles.labelSkeleton} />
						<Skeleton className={styles.valueSkeleton} />
					</div>
				))}
			</div>
		</>
	);
}

export { ScheduledSummarySkeleton };
