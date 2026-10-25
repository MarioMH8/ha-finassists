import { classNames } from '@app/components/class-names';
import type { ElementType, HTMLAttributes, ReactElement, ReactNode, Ref } from 'react';

import styles from './card.module.css';

const CARD_PADDING = {
	DEFAULT: 'default',
	LARGE: 'large',
} as const;

const CARD_TONE = {
	DEFAULT: 'default',
	SUBTLE: 'subtle',
} as const;

type CardPadding = (typeof CARD_PADDING)[keyof typeof CARD_PADDING];
type CardTone = (typeof CARD_TONE)[keyof typeof CARD_TONE];

interface CardProps extends HTMLAttributes<HTMLElement> {
	as?: ElementType;
	bleed?: boolean;
	children: ReactNode;
	padding?: CardPadding;
	ref?: Ref<HTMLElement>;
	tone?: CardTone;
}

function Card({
	as: Component = 'section',
	bleed = false,
	children,
	className,
	padding = CARD_PADDING.DEFAULT,
	ref,
	tone = CARD_TONE.DEFAULT,
	...props
}: CardProps): ReactElement {
	return (
		<Component
			className={classNames(
				styles.card,
				padding === CARD_PADDING.LARGE && styles.large,
				tone === CARD_TONE.SUBTLE && styles.subtle,
				bleed && styles.bleed,
				className
			)}
			ref={ref}
			{...props}>
			{children}
		</Component>
	);
}

export { Card, CARD_PADDING, CARD_TONE, type CardPadding, type CardTone };
