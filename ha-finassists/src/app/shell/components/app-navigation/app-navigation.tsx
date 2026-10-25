import type { TabItem } from '@app/components/tabs';
import { Tabs } from '@app/components/tabs';
import type { ReactElement } from 'react';

import styles from './app-navigation.module.css';

interface AppNavigationProps<TSection extends string> {
	ariaLabel: string;
	items: readonly TabItem<TSection>[];
	onChange: (section: TSection) => void;
	value: TSection;
}

function AppNavigation<TSection extends string>({
	ariaLabel,
	items,
	onChange,
	value,
}: AppNavigationProps<TSection>): ReactElement {
	return (
		<div className={styles.band}>
			<Tabs
				ariaLabel={ariaLabel}
				items={items}
				onChange={onChange}
				value={value}
			/>
		</div>
	);
}

export { AppNavigation };
