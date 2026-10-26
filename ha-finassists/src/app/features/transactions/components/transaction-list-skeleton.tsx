import { DataTable } from '@app/components/data-table';
import { LoadingStatus, SkeletonTableBody } from '@app/components/skeleton';
import type { Copy } from '@app/i18n';
import type { ReactElement, ReactNode } from 'react';

const TRANSACTION_COLUMNS = 6;

interface TransactionListSkeletonProps {
	copy: Copy;
	head: ReactNode;
	header: ReactNode;
}

function TransactionListSkeleton({ copy, head, header }: TransactionListSkeletonProps): ReactElement {
	return (
		<>
			<LoadingStatus label={copy.transactionLoading} />
			<DataTable header={header}>
				{head}
				<SkeletonTableBody columns={TRANSACTION_COLUMNS} />
			</DataTable>
		</>
	);
}

export { TransactionListSkeleton };
