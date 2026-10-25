import { classNames } from '@app/components/class-names';
import type { IconName } from '@app/components/icon';
import { Icon } from '@app/components/icon';
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';

import styles from './chip.module.css';

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	badge?: number;
	children: ReactNode;
	icon?: IconName;
}

/*
 * Outlined chip for view options such as filters, in the spirit of the Home
 * Assistant assist chip.
 * https://contributors.home-assistant.io/design/components/button/
 */
function Chip({ badge, children, className, icon, type = 'button', ...props }: ChipProps): ReactElement {
	return (
		<button
			className={classNames(styles.chip, className)}
			type={type}
			{...props}>
			{icon ? <Icon name={icon} /> : undefined}
			<span>{children}</span>
			{badge ? <span className={styles.badge}>{badge}</span> : undefined}
		</button>
	);
}

export { Chip, type ChipProps };
