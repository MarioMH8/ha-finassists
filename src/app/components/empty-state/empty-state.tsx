import { classNames } from '@app/components/class-names';
import type { ReactElement, ReactNode } from 'react';

import styles from './empty-state.module.css';

interface EmptyStateProps {
	action?: ReactNode;
	children?: ReactNode;
	className?: string;
	title: ReactNode;
}

function EmptyState({ action, children, className, title }: EmptyStateProps): ReactElement {
	return (
		<div className={classNames(styles.emptyState, className)}>
			<p className={styles.title}>{title}</p>
			{children ? <p className={styles.description}>{children}</p> : undefined}
			{action}
		</div>
	);
}

export { EmptyState };
