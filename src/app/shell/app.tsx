import { TokenManagement } from '@app/features/api-tokens';
import { FinanceManagement } from '@app/features/finance/finance-management';
import type { Language } from '@app/i18n/language';
import { LocaleProvider } from '@app/i18n/locale-context';
import type { ShellConfig } from '@modules/shell/domain';
import type { ReactElement } from 'react';
import { useState } from 'react';

import styles from './app.module.css';

interface AppProps {
	language: Language;
	settings: ShellConfig;
}

function App({ language, settings }: AppProps): ReactElement {
	const [showTokens, setShowTokens] = useState(false);

	return (
		<LocaleProvider language={language}>
			<div className={styles['app-shell']}>
				<header className={styles['app-header']}>
					{settings.showLogo && (
						<svg
							aria-hidden='true'
							className={styles['brand-mark']}
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
					<h1>{settings.applicationName}</h1>
				</header>
				{settings.showNavigation && (
					<nav aria-label={language === 'es' ? 'Navegación de la aplicación' : 'Application navigation'}>
						<button
							aria-current={showTokens ? undefined : 'page'}
							onClick={() => setShowTokens(false)}
							type='button'>
							{language === 'es' ? 'Finanzas' : 'Finance'}
						</button>
						<button
							aria-current={showTokens ? 'page' : undefined}
							onClick={() => setShowTokens(true)}
							type='button'>
							{language === 'es' ? 'Tokens API' : 'API tokens'}
						</button>
					</nav>
				)}
				<main
					className={styles['main-content']}
					id='main-content'
					tabIndex={-1}>
					{showTokens ? <TokenManagement /> : <FinanceManagement />}
				</main>
			</div>
		</LocaleProvider>
	);
}

export { App };
