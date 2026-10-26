import { classNames } from '@app/components/class-names';
import type { IconName } from '@app/components/icon';
import { Icon } from '@app/components/icon';
import type { ReactElement, ReactNode } from 'react';

import styles from './empty-state.module.css';

interface EmptyStateProps {
	action?: ReactNode;
	children?: ReactNode;
	className?: string;
	icon?: IconName;
	title: ReactNode;
}

function EmptyState({ action, children, className, icon, title }: EmptyStateProps): ReactElement {
	return (
		<div className={classNames(styles.emptyState, className)}>
			{icon ? (
				<Icon
					className={styles.icon}
					name={icon}
				/>
			) : undefined}
			<h2 className={styles.title}>{title}</h2>
			{children ? <p className={styles.description}>{children}</p> : undefined}
			{action ? <div className={styles.actions}>{action}</div> : undefined}
		</div>
	);
}

export { EmptyState };
