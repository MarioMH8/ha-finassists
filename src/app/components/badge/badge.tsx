import { classNames } from '@app/components/class-names';
import type { HTMLAttributes, ReactElement, ReactNode } from 'react';

import styles from './badge.module.css';

const BADGE_TONE = {
	DANGER: 'danger',
	NEUTRAL: 'neutral',
	SUCCESS: 'success',
	WARNING: 'warning',
} as const;

type BadgeTone = (typeof BADGE_TONE)[keyof typeof BADGE_TONE];

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
	children: ReactNode;
	tone?: BadgeTone;
}

function Badge({ children, className, tone = BADGE_TONE.NEUTRAL, ...props }: BadgeProps): ReactElement {
	return (
		<span
			className={classNames(styles.badge, styles[tone], className)}
			{...props}>
			{children}
		</span>
	);
}

export { Badge, BADGE_TONE, type BadgeTone };
