import { classNames } from '@app/components/class-names';
import type { InputHTMLAttributes, ReactElement, Ref } from 'react';

import styles from './text-input.module.css';

const TEXT_INPUT_SIZE = {
	MEDIUM: 'm',
	SMALL: 's',
} as const;

type TextInputSize = (typeof TEXT_INPUT_SIZE)[keyof typeof TEXT_INPUT_SIZE];

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
	invalid?: boolean;
	ref?: Ref<HTMLInputElement>;
	size?: TextInputSize;
}

function TextInput({
	className,
	invalid = false,
	ref,
	size = TEXT_INPUT_SIZE.MEDIUM,
	type = 'text',
	...props
}: TextInputProps): ReactElement {
	return (
		<input
			aria-invalid={invalid || undefined}
			className={classNames(styles.input, styles[size], className)}
			ref={ref}
			type={type}
			{...props}
		/>
	);
}

export { TEXT_INPUT_SIZE, TextInput, type TextInputSize };
