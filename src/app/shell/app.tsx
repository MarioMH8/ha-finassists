import { TokenManagement } from '@app/features/api-tokens';
import type { Language } from '@app/i18n/language';
import { LocaleProvider } from '@app/i18n/locale-context';
import type { ReactElement } from 'react';

import styles from './app.module.css';

interface AppProps {
	language: Language;
}

function App({ language }: AppProps): ReactElement {
	return (
		<LocaleProvider language={language}>
			<div className={styles['app-shell']}>
				<header className={styles['app-header']}>
					<div
						aria-hidden='true'
						className={styles['brand-mark']}>
						F
					</div>
					<h1>Fin Assist</h1>
				</header>
				<main
					className={styles['main-content']}
					id='main-content'
					tabIndex={-1}>
					<TokenManagement />
				</main>
			</div>
		</LocaleProvider>
	);
}

export { App };
