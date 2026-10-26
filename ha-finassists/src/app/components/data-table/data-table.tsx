import { classNames } from '@app/components/class-names';
import type {
	HTMLAttributes,
	ReactElement,
	ReactNode,
	TableHTMLAttributes,
	TdHTMLAttributes,
	ThHTMLAttributes,
} from 'react';

import styles from './data-table.module.css';

const DATA_ALIGN = {
	CENTER: 'center',
	END: 'end',
	START: 'start',
} as const;

type DataAlign = (typeof DATA_ALIGN)[keyof typeof DATA_ALIGN];

interface DataTableProps extends TableHTMLAttributes<HTMLTableElement> {
	caption?: ReactNode;
	children: ReactNode;
	header?: ReactNode;
	wrapperClassName?: string;
}

function DataTable({ caption, children, className, header, wrapperClassName, ...props }: DataTableProps): ReactElement {
	return (
		<div className={classNames(styles.wrapper, wrapperClassName)}>
			{header ? <div className={styles.header}>{header}</div> : undefined}
			<div className={styles.scroller}>
				<table
					className={classNames(styles.table, className)}
					{...props}>
					{caption ? <caption className={styles.caption}>{caption}</caption> : undefined}
					{children}
				</table>
			</div>
		</div>
	);
}

interface DataCellProps extends Omit<TdHTMLAttributes<HTMLTableCellElement>, 'align'> {
	align?: DataAlign;
	numeric?: boolean;
}

function DataCell({ align, className, numeric = false, ...props }: DataCellProps): ReactElement {
	return (
		<td
			className={classNames(
				styles[align ?? (numeric ? DATA_ALIGN.END : DATA_ALIGN.START)],
				numeric && styles.numeric,
				className
			)}
			{...props}
		/>
	);
}

interface DataHeaderCellProps extends Omit<ThHTMLAttributes<HTMLTableCellElement>, 'align'> {
	align?: DataAlign;
}

function DataHeaderCell({ align = DATA_ALIGN.START, className, ...props }: DataHeaderCellProps): ReactElement {
	return (
		<th
			className={classNames(styles[align], className)}
			{...props}
		/>
	);
}

function DataRowActions({ className, ...props }: HTMLAttributes<HTMLDivElement>): ReactElement {
	return (
		<div
			className={classNames(styles.actions, className)}
			{...props}
		/>
	);
}

export { DATA_ALIGN, type DataAlign, DataCell, DataHeaderCell, DataRowActions, DataTable };
