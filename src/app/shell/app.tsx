import { TokenManagement } from '@app/features/api-tokens';
import { FinanceManagement } from '@app/features/finance/finance-management';
import { SummaryDashboard } from '@app/features/summary';
import type { Language } from '@app/i18n/language';
import { LocaleProvider } from '@app/i18n/locale-context';
import { BudgetPlanning } from '@modules/budgets/presentation';
import { SchedulePlanning } from '@modules/schedules/presentation';
import { SharedExpensesWorkspace } from '@modules/shared-expenses/presentation';
import type { ShellConfig } from '@modules/shell/domain';
import type { ReactElement } from 'react';
import { useState } from 'react';

import styles from './app.module.css';

interface AppProps {
	language: Language;
	settings: ShellConfig;
}

const SECTION = {
	FINANCE: 'finance',
	PLANNING: 'planning',
	SHARED_EXPENSES: 'shared-expenses',
	SUMMARY: 'summary',
	TOKENS: 'tokens',
} as const;

type Section = (typeof SECTION)[keyof typeof SECTION];

function App({ language, settings }: AppProps): ReactElement {
	const [section, setSection] = useState<Section>(SECTION.SUMMARY);
	const [financeStartSection, setFinanceStartSection] = useState<'accounts' | 'transactions'>('accounts');
	const labels: Record<Section, string> =
		language === 'es'
			? {
					[SECTION.FINANCE]: 'Finanzas',
					[SECTION.PLANNING]: 'Planificación',
					[SECTION.SHARED_EXPENSES]: 'Gastos compartidos',
					[SECTION.SUMMARY]: 'Resumen',
					[SECTION.TOKENS]: 'Tokens API',
				}
			: {
					[SECTION.FINANCE]: 'Finance',
					[SECTION.PLANNING]: 'Planning',
					[SECTION.SHARED_EXPENSES]: 'Shared expenses',
					[SECTION.SUMMARY]: 'Summary',
					[SECTION.TOKENS]: 'Tokens / API',
				};
	const sections: Section[] = settings.showNavigation
		? [SECTION.SUMMARY, SECTION.FINANCE, SECTION.PLANNING, SECTION.SHARED_EXPENSES, SECTION.TOKENS]
		: [SECTION.SUMMARY];

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
				{sections.length > 1 && (
					<nav
						aria-label={language === 'es' ? 'Navegación de la aplicación' : 'Application navigation'}
						className={styles.navigation}>
						{sections.map(item => (
							<button
								aria-current={section === item ? 'page' : undefined}
								key={item}
								onClick={() => setSection(item)}
								type='button'>
								{labels[item]}
							</button>
						))}
					</nav>
				)}
				<main
					className={styles['main-content']}
					id='main-content'
					tabIndex={-1}>
					{section === SECTION.SUMMARY && (
						<SummaryDashboard
							language={language}
							onAddExpense={() => {
								setFinanceStartSection('transactions');
								setSection(SECTION.FINANCE);
							}}
						/>
					)}
					{section === SECTION.FINANCE && <FinanceManagement initialSection={financeStartSection} />}
					{section === SECTION.PLANNING && (
						<div className={styles['planning-content']}>
							<BudgetPlanning />
							<SchedulePlanning />
						</div>
					)}
					{section === SECTION.SHARED_EXPENSES && <SharedExpensesWorkspace />}
					{section === SECTION.TOKENS && <TokenManagement />}
				</main>
			</div>
		</LocaleProvider>
	);
}

export { App };
