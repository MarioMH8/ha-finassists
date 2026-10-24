import { classNames } from '@app/components/class-names';
import type { HTMLAttributes, ReactElement, ReactNode, TableHTMLAttributes, TdHTMLAttributes } from 'react';

import styles from './data-table.module.css';

interface DataTableProps extends TableHTMLAttributes<HTMLTableElement> {
	caption?: ReactNode;
	children: ReactNode;
	wrapperClassName?: string;
}

function DataTable({ caption, children, className, wrapperClassName, ...props }: DataTableProps): ReactElement {
	return (
		<div className={classNames(styles.wrapper, wrapperClassName)}>
			<table
				className={classNames(styles.table, className)}
				{...props}>
				{caption ? <caption className={styles.caption}>{caption}</caption> : undefined}
				{children}
			</table>
		</div>
	);
}

interface DataCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
	numeric?: boolean;
}

function DataCell({ className, numeric = false, ...props }: DataCellProps): ReactElement {
	return (
		<td
			className={classNames(numeric && styles.numeric, className)}
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

export { DataCell, DataRowActions, DataTable };
