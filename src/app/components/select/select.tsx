import { classNames } from '@app/components/class-names';
import type { ReactElement, Ref, SelectHTMLAttributes } from 'react';

import styles from './select.module.css';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
	invalid?: boolean;
	ref?: Ref<HTMLSelectElement>;
}

function Select({ children, className, invalid = false, ref, ...props }: SelectProps): ReactElement {
	return (
		<select
			aria-invalid={invalid || undefined}
			className={classNames(styles.select, className)}
			ref={ref}
			{...props}>
			{children}
		</select>
	);
}

export { Select };
