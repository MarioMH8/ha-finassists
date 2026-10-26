import { AdministrationManagement } from '@app/features/administration';
import { CategoriesManagement } from '@app/features/categories';
import { TransactionsManagement } from '@app/features/transactions';
import { getCopy } from '@app/i18n';
import type { Language } from '@app/i18n/language';
import { LocaleProvider } from '@app/i18n/locale-context';
import type { ShellConfig } from '@modules/shell/domain';
import type { ReactElement } from 'react';

import styles from './app.module.css';
import { AppNavigation } from './components';
import type { Section } from './section-route';
import { SECTION, SECTIONS, useSectionRoute } from './section-route';

interface AppProps {
	language: Language;
	settings: ShellConfig;
}

function App({ language, settings }: AppProps): ReactElement {
	const [section, setSection] = useSectionRoute();
	const copy = getCopy(language);
	const labels: Record<Section, string> = {
		[SECTION.ADMINISTRATION]: copy.navigationAdministration,
		[SECTION.CATEGORIES]: copy.navigationCategories,
		[SECTION.TRANSACTIONS]: copy.navigationTransactions,
	};

	return (
		<LocaleProvider language={language}>
			<div className={styles['app-shell']}>
				<AppNavigation
					ariaLabel={copy.navigationAriaLabel}
					items={SECTIONS.map(item => ({ label: labels[item], value: item }))}
					onChange={setSection}
					value={section}
				/>
				<main
					className={styles['main-content']}
					id='main-content'
					tabIndex={-1}>
					<h1
						className={styles['visually-hidden']}
						id='page-title'
						tabIndex={-1}>
						{settings.applicationName}
					</h1>
					{section === SECTION.TRANSACTIONS && (
						<TransactionsManagement currencyCode={settings.currencyCode} />
					)}
					{section === SECTION.CATEGORIES && <CategoriesManagement />}
					{section === SECTION.ADMINISTRATION && <AdministrationManagement />}
				</main>
			</div>
		</LocaleProvider>
	);
}

export { App };
