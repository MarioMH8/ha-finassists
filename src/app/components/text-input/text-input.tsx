import { classNames } from '@app/components/class-names';
import type { InputHTMLAttributes, ReactElement, Ref } from 'react';

import styles from './text-input.module.css';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
	invalid?: boolean;
	ref?: Ref<HTMLInputElement>;
}

function TextInput({ className, invalid = false, ref, type = 'text', ...props }: TextInputProps): ReactElement {
	return (
		<input
			aria-invalid={invalid || undefined}
			className={classNames(styles.input, className)}
			ref={ref}
			type={type}
			{...props}
		/>
	);
}

export { TextInput };
