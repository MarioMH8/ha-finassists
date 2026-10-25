import { classNames } from '@app/components/class-names';
import type { ButtonHTMLAttributes, ReactElement, ReactNode, Ref } from 'react';

import styles from './button.module.css';

/*
 * Mirrors the Home Assistant button model: an appearance controls how much of
 * the variant color is used, and the variant selects the color family.
 * https://contributors.home-assistant.io/design/components/button/
 */
const BUTTON_APPEARANCE = {
	ACCENT: 'accent',
	FILLED: 'filled',
	OUTLINED: 'outlined',
	PLAIN: 'plain',
} as const;

const BUTTON_VARIANT = {
	BRAND: 'brand',
	DANGER: 'danger',
	NEUTRAL: 'neutral',
	SUCCESS: 'success',
	WARNING: 'warning',
} as const;

const BUTTON_SIZE = {
	EXTRA_SMALL: 'xs',
	LARGE: 'l',
	MEDIUM: 'm',
	SMALL: 's',
} as const;

type ButtonAppearance = (typeof BUTTON_APPEARANCE)[keyof typeof BUTTON_APPEARANCE];
type ButtonVariant = (typeof BUTTON_VARIANT)[keyof typeof BUTTON_VARIANT];
type ButtonSize = (typeof BUTTON_SIZE)[keyof typeof BUTTON_SIZE];

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	appearance?: ButtonAppearance;
	children: ReactNode;
	ref?: Ref<HTMLButtonElement>;
	size?: ButtonSize;
	variant?: ButtonVariant;
}

function Button({
	appearance = BUTTON_APPEARANCE.OUTLINED,
	children,
	className,
	ref,
	size = BUTTON_SIZE.MEDIUM,
	variant = BUTTON_VARIANT.NEUTRAL,
	...props
}: ButtonProps): ReactElement {
	return (
		<button
			className={classNames(styles.button, styles[appearance], styles[variant], styles[size], className)}
			data-appearance={appearance}
			data-variant={variant}
			ref={ref}
			{...props}>
			{children}
		</button>
	);
}

export {
	Button,
	BUTTON_APPEARANCE,
	BUTTON_SIZE,
	BUTTON_VARIANT,
	type ButtonAppearance,
	type ButtonSize,
	type ButtonVariant,
};
