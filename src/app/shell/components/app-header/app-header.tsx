import type { ReactElement } from 'react';

import styles from './app-header.module.css';

interface AppHeaderProps {
	applicationName: string;
	showLogo: boolean;
}

function AppHeader({ applicationName, showLogo }: AppHeaderProps): ReactElement {
	return (
		<header className={styles['app-header']}>
			{showLogo && (
				<svg
					aria-hidden='true'
					className={styles.brandMark}
					fill='none'
					viewBox='0 0 40 40'>
					<path
						d='M11 10.5h14a4.5 4.5 0 0 1 4.5 4.5v15H14.5a3.5 3.5 0 0 1-3.5-3.5zM16 16h5M16 20h3'
						stroke='currentColor'
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth='2'
					/>
					<path
						d='m20 25 3-3 2 1.5 3-4'
						stroke='currentColor'
						strokeLinecap='round'
						strokeLinejoin='round'
						strokeWidth='2'
					/>
					<circle
						cx='28'
						cy='19.5'
						fill='currentColor'
						r='1.5'
					/>
				</svg>
			)}
			<h1 className={styles.title}>{applicationName}</h1>
		</header>
	);
}

export { AppHeader };
