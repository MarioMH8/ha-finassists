import { classNames } from '@app/components/class-names';
import type { HTMLAttributes, ReactElement, ReactNode } from 'react';

import styles from './notice.module.css';

const NOTICE_TONE = {
	ERROR: 'error',
	INFO: 'info',
	SUCCESS: 'success',
	WARNING: 'warning',
} as const;

type NoticeTone = (typeof NOTICE_TONE)[keyof typeof NOTICE_TONE];

interface NoticeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
	children: ReactNode;
	tone?: NoticeTone;
}

function Notice({ children, className, tone = NOTICE_TONE.INFO, ...props }: NoticeProps): ReactElement {
	return (
		<div
			className={classNames(styles.notice, styles[tone], className)}
			role={tone === NOTICE_TONE.ERROR ? 'alert' : 'status'}
			{...props}>
			{children}
		</div>
	);
}

export { Notice, NOTICE_TONE, type NoticeTone };
