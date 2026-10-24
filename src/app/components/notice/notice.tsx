import { classNames } from '@app/components/class-names';
import type { HTMLAttributes, ReactElement, ReactNode } from 'react';

import styles from './notice.module.css';

/*
 * Mirrors the Home Assistant alert: a tinted panel with a leading type icon.
 * https://contributors.home-assistant.io/design/components/alert/
 */
const NOTICE_TONE = {
	ERROR: 'error',
	INFO: 'info',
	SUCCESS: 'success',
	WARNING: 'warning',
} as const;

type NoticeTone = (typeof NOTICE_TONE)[keyof typeof NOTICE_TONE];

const TONE_ICON_PATH: Record<NoticeTone, string> = {
	error: 'M13,13H11V7H13M13,17H11V15H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z',
	info: 'M13,9H11V7H13M13,17H11V11H13M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z',
	success:
		'M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,16.5L6.5,12L7.91,10.59L11,13.67L16.59,8.09L18,9.5L11,16.5Z',
	warning: 'M13,14H11V9H13M13,18H11V16H13M1,21H23L12,2L1,21Z',
};

interface NoticeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
	children: ReactNode;
	tone?: NoticeTone;
}

function Notice({ children, className, tone = NOTICE_TONE.INFO, ...props }: NoticeProps): ReactElement {
	return (
		<div
			className={classNames(styles.notice, styles[tone], className)}
			role='alert'
			{...props}>
			<span
				aria-hidden='true'
				className={styles.icon}>
				<svg
					fill='currentColor'
					viewBox='0 0 24 24'>
					<path d={TONE_ICON_PATH[tone]} />
				</svg>
			</span>
			<div className={styles.content}>{children}</div>
		</div>
	);
}

export { Notice, NOTICE_TONE, type NoticeTone };
