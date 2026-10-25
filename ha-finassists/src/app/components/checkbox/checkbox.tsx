import { classNames } from '@app/components/class-names';
import type { InputHTMLAttributes, ReactElement, ReactNode, Ref } from 'react';

import styles from './checkbox.module.css';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
	label: ReactNode;
	ref?: Ref<HTMLInputElement>;
}

function Checkbox({ className, label, ref, ...props }: CheckboxProps): ReactElement {
	return (
		<label className={classNames(styles.checkbox, className)}>
			<input
				className={styles.input}
				ref={ref}
				type='checkbox'
				{...props}
			/>
			<span>{label}</span>
		</label>
	);
}

export { Checkbox };
