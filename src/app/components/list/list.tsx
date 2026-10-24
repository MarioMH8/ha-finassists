import { classNames } from '@app/components/class-names';
import type { HTMLAttributes, LiHTMLAttributes, ReactElement, ReactNode, Ref } from 'react';

import styles from './list.module.css';

interface ListProps extends HTMLAttributes<HTMLUListElement> {
	ref?: Ref<HTMLUListElement>;
}

function List({ className, ...props }: ListProps): ReactElement {
	return (
		<ul
			className={classNames(styles.list, className)}
			{...props}
		/>
	);
}

interface ListItemProps extends LiHTMLAttributes<HTMLLIElement> {
	actions?: ReactNode;
	children: ReactNode;
}

function ListItem({ actions, children, className, ...props }: ListItemProps): ReactElement {
	return (
		<li
			className={classNames(styles.item, className)}
			{...props}>
			<div className={styles.content}>{children}</div>
			{actions ? <div className={styles.actions}>{actions}</div> : undefined}
		</li>
	);
}

export { List, ListItem };
