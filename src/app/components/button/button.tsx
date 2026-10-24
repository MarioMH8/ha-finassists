import { classNames } from '@app/components/class-names';
import type { ButtonHTMLAttributes, ReactElement, ReactNode, Ref } from 'react';

import styles from './button.module.css';

const BUTTON_VARIANT = {
	DANGER: 'danger',
	DANGER_CONFIRM: 'dangerConfirm',
	GHOST: 'ghost',
	PRIMARY: 'primary',
	SECONDARY: 'secondary',
} as const;

const BUTTON_SIZE = {
	COMPACT: 'compact',
	DEFAULT: 'default',
} as const;

type ButtonVariant = (typeof BUTTON_VARIANT)[keyof typeof BUTTON_VARIANT];
type ButtonSize = (typeof BUTTON_SIZE)[keyof typeof BUTTON_SIZE];

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	children: ReactNode;
	ref?: Ref<HTMLButtonElement>;
	size?: ButtonSize;
	variant?: ButtonVariant;
}

function Button({
	children,
	className,
	ref,
	size = BUTTON_SIZE.DEFAULT,
	variant = BUTTON_VARIANT.SECONDARY,
	...props
}: ButtonProps): ReactElement {
	return (
		<button
			className={classNames(styles.button, styles[variant], styles[size], className)}
			data-variant={variant}
			ref={ref}
			{...props}>
			{children}
		</button>
	);
}

export { Button, BUTTON_SIZE, BUTTON_VARIANT, type ButtonSize, type ButtonVariant };
