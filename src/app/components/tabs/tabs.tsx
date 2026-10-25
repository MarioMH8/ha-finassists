import { classNames } from '@app/components/class-names';
import type { ReactElement, ReactNode } from 'react';

import styles from './tabs.module.css';

interface TabItem<TValue extends string> {
	label: ReactNode;
	value: TValue;
}

interface TabsProps<TValue extends string> {
	ariaLabel: string;
	className?: string;
	items: readonly TabItem<TValue>[];
	onChange: (value: TValue) => void;
	value: TValue;
}

function Tabs<TValue extends string>({
	ariaLabel,
	className,
	items,
	onChange,
	value,
}: TabsProps<TValue>): ReactElement {
	return (
		<nav
			aria-label={ariaLabel}
			className={classNames(styles.tabs, className)}>
			{items.map(item => (
				<button
					aria-current={item.value === value ? 'page' : undefined}
					className={styles.tab}
					key={item.value}
					onClick={() => {
						onChange(item.value);
					}}
					type='button'>
					{item.label}
				</button>
			))}
		</nav>
	);
}

export { type TabItem, Tabs };
