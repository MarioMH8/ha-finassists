import { classNames } from '@app/components/class-names';
import type { ReactElement } from 'react';

import styles from './skeleton.module.css';

const SKELETON_SHAPE = {
	CIRCLE: 'circle',
	TEXT: 'text',
} as const;

type SkeletonShape = (typeof SKELETON_SHAPE)[keyof typeof SKELETON_SHAPE];

const DEFAULT_TABLE_ROWS = 6;

interface SkeletonProps {
	className?: string | undefined;
	shape?: SkeletonShape;
}

function Skeleton({ className, shape = SKELETON_SHAPE.TEXT }: SkeletonProps): ReactElement {
	return (
		<span
			aria-hidden='true'
			className={classNames(styles.skeleton, styles[shape], className)}
			data-skeleton={shape}
		/>
	);
}

interface SkeletonTableBodyProps {
	columns: number;
	rows?: number;
}

function SkeletonTableBody({ columns, rows = DEFAULT_TABLE_ROWS }: SkeletonTableBodyProps): ReactElement {
	return (
		<tbody
			aria-hidden='true'
			className={styles.rows}
			data-skeleton='rows'>
			{Array.from({ length: rows }, (_, row) => (
				<tr key={row}>
					{Array.from({ length: columns }, (_, column) => (
						<td key={column}>
							<Skeleton className={styles.cell} />
						</td>
					))}
				</tr>
			))}
		</tbody>
	);
}

interface LoadingStatusProps {
	label: string;
}

function LoadingStatus({ label }: LoadingStatusProps): ReactElement {
	return (
		<p
			className={styles.status}
			role='status'>
			{label}
		</p>
	);
}

export { LoadingStatus, Skeleton, SKELETON_SHAPE, type SkeletonShape, SkeletonTableBody };
