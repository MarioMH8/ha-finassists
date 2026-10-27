import { DataTable } from '@app/components/data-table';
import { LoadingStatus, SkeletonTableBody } from '@app/components/skeleton';
import type { Copy } from '@app/i18n';
import type { ReactElement, ReactNode } from 'react';

const SCHEDULED_COLUMNS = 7;

interface ScheduledTransactionListSkeletonProps {
	copy: Copy;
	head: ReactNode;
}

function ScheduledTransactionListSkeleton({ copy, head }: ScheduledTransactionListSkeletonProps): ReactElement {
	return (
		<>
			<LoadingStatus label={copy.scheduledLoading} />
			<DataTable>
				{head}
				<SkeletonTableBody columns={SCHEDULED_COLUMNS} />
			</DataTable>
		</>
	);
}

export { ScheduledTransactionListSkeleton };
