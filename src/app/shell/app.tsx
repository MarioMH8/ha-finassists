import { TokenManagement } from '@app/features/api-tokens';
import { TransactionsManagement } from '@app/features/transactions';
import { getCopy } from '@app/i18n';
import type { Language } from '@app/i18n/language';
import { LocaleProvider } from '@app/i18n/locale-context';
import type { ShellConfig } from '@modules/shell/domain';
import type { ReactElement } from 'react';
import { useState } from 'react';

import styles from './app.module.css';
import { AppHeader, AppNavigation } from './components';

interface AppProps {
	language: Language;
	settings: ShellConfig;
}

const SECTION = {
	TOKENS: 'tokens',
	TRANSACTIONS: 'transactions',
} as const;

type Section = (typeof SECTION)[keyof typeof SECTION];

function App({ language, settings }: AppProps): ReactElement {
	const [section, setSection] = useState<Section>(SECTION.TRANSACTIONS);
	const copy = getCopy(language);
	const labels: Record<Section, string> = {
		[SECTION.TOKENS]: copy.navigationTokens,
		[SECTION.TRANSACTIONS]: copy.navigationTransactions,
	};
	const sections: Section[] = settings.showNavigation
		? [SECTION.TRANSACTIONS, SECTION.TOKENS]
		: [SECTION.TRANSACTIONS];

	return (
		<LocaleProvider language={language}>
			<div className={styles['app-shell']}>
				<AppHeader
					applicationName={settings.applicationName}
					showLogo={settings.showLogo}
				/>
				{sections.length > 1 && (
					<AppNavigation
						ariaLabel={copy.navigationAriaLabel}
						items={sections.map(item => ({ label: labels[item], value: item }))}
						onChange={setSection}
						value={section}
					/>
				)}
				<main
					className={styles['main-content']}
					id='main-content'
					tabIndex={-1}>
					{section === SECTION.TRANSACTIONS && (
						<TransactionsManagement currencyCode={settings.currencyCode} />
					)}
					{section === SECTION.TOKENS && <TokenManagement />}
				</main>
			</div>
		</LocaleProvider>
	);
}

export { App };
