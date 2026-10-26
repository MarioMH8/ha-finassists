import { DataTable } from '@app/components/data-table';
import { LoadingStatus, SkeletonTableBody } from '@app/components/skeleton';
import type { Copy } from '@app/i18n';
import type { ReactElement, ReactNode } from 'react';

const CATEGORY_COLUMNS = 4;

interface CategoryListSkeletonProps {
	copy: Copy;
	head: ReactNode;
	header: ReactNode;
}

function CategoryListSkeleton({ copy, head, header }: CategoryListSkeletonProps): ReactElement {
	return (
		<>
			<LoadingStatus label={copy.categoryLoading} />
			<DataTable header={header}>
				{head}
				<SkeletonTableBody columns={CATEGORY_COLUMNS} />
			</DataTable>
		</>
	);
}

export { CategoryListSkeleton };
