import type { ButtonHTMLAttributes, ReactElement, ReactNode, Ref } from 'react';

import styles from './button.module.css';

const BUTTON_VARIANT = {
	DANGER: 'danger',
	DANGER_CONFIRM: 'dangerConfirm',
	PRIMARY: 'primary',
	SECONDARY: 'secondary',
} as const;

type ButtonVariant = (typeof BUTTON_VARIANT)[keyof typeof BUTTON_VARIANT];

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	children: ReactNode;
	ref?: Ref<HTMLButtonElement>;
	variant?: ButtonVariant;
}

function Button({ children, className, ref, variant = BUTTON_VARIANT.SECONDARY, ...props }: ButtonProps): ReactElement {
	const classes = [styles.button, styles[variant], className].filter(Boolean).join(' ');

	return (
		<button
			className={classes}
			data-variant={variant}
			ref={ref}
			{...props}>
			{children}
		</button>
	);
}

export { Button, BUTTON_VARIANT, type ButtonVariant };
