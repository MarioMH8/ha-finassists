import { classNames } from '@app/components/class-names';
import type { ReactElement, ReactNode } from 'react';

import styles from './section-heading.module.css';

interface SectionHeadingProps {
	actions?: ReactNode;
	className?: string;
	description?: ReactNode;
	eyebrow?: ReactNode;
	level?: 2 | 3;
	title: ReactNode;
	titleId?: string;
}

function SectionHeading({
	actions,
	className,
	description,
	eyebrow,
	level = 2,
	title,
	titleId,
}: SectionHeadingProps): ReactElement {
	const Heading = level === 2 ? 'h2' : 'h3';

	return (
		<header className={classNames(styles.heading, className)}>
			<div className={styles.text}>
				{eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : undefined}
				<Heading
					className={styles.title}
					id={titleId}>
					{title}
				</Heading>
				{description ? <p className={styles.description}>{description}</p> : undefined}
			</div>
			{actions ? <div className={styles.actions}>{actions}</div> : undefined}
		</header>
	);
}

export { SectionHeading };
