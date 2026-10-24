import { classNames } from '@app/components/class-names';
import type { ElementType, HTMLAttributes, ReactElement, ReactNode, Ref } from 'react';

import styles from './card.module.css';

const CARD_TONE = {
	DEFAULT: 'default',
	SUBTLE: 'subtle',
} as const;

type CardTone = (typeof CARD_TONE)[keyof typeof CARD_TONE];

interface CardProps extends HTMLAttributes<HTMLElement> {
	as?: ElementType;
	bleed?: boolean;
	children: ReactNode;
	ref?: Ref<HTMLElement>;
	tone?: CardTone;
}

function Card({
	as: Component = 'section',
	bleed = false,
	children,
	className,
	tone = CARD_TONE.DEFAULT,
	...props
}: CardProps): ReactElement {
	return (
		<Component
			className={classNames(
				styles.card,
				tone === CARD_TONE.SUBTLE && styles.subtle,
				bleed && styles.bleed,
				className
			)}
			{...props}>
			{children}
		</Component>
	);
}

export { Card, CARD_TONE, type CardTone };
