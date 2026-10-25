import { classNames } from '@app/components/class-names';
import { Icon, ICON_NAME } from '@app/components/icon';
import type { ReactElement, Ref, SelectHTMLAttributes } from 'react';

import styles from './select.module.css';

const SELECT_SIZE = {
	EXTRA_SMALL: 'xs',
	MEDIUM: 'm',
	SMALL: 's',
} as const;

type SelectSize = (typeof SELECT_SIZE)[keyof typeof SELECT_SIZE];

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
	invalid?: boolean;
	ref?: Ref<HTMLSelectElement>;
	size?: SelectSize;
}

function Select({
	children,
	className,
	invalid = false,
	ref,
	size = SELECT_SIZE.MEDIUM,
	...props
}: SelectProps): ReactElement {
	return (
		<span className={styles.wrapper}>
			<select
				aria-invalid={invalid || undefined}
				className={classNames(styles.select, styles[size], className)}
				ref={ref}
				{...props}>
				{children}
			</select>
			<Icon
				className={styles.chevron}
				name={ICON_NAME.CHEVRON_DOWN}
			/>
		</span>
	);
}

export { Select, SELECT_SIZE, type SelectSize };
