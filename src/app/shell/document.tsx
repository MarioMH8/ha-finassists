import type { Language } from '@app/i18n/language';
import type { AppShellSettings } from '@modules/app-configuration/domain';
import { DEFAULT_APP_SHELL_SETTINGS } from '@modules/app-configuration/domain';
import type { ReactElement, ReactNode } from 'react';

import { App } from './app';
import styles from './document.module.css';

interface DocumentProps {
	children: ReactNode;
	developmentMode: boolean;
	language: Language;
	settings: AppShellSettings;
}

interface WebPageProps {
	developmentMode?: boolean;
	language: Language;
	settings?: AppShellSettings;
}

function Document({ children, developmentMode, language, settings }: DocumentProps): ReactElement {
	return (
		<html lang={language}>
			<head>
				<meta charSet='utf-8' />
				<meta
					content='width=device-width, initial-scale=1'
					name='viewport'
				/>
				<meta
					content='#03a9f4'
					name='theme-color'
				/>
				<title>{settings.applicationName}</title>
				<link
					href='./styles.css'
					rel='stylesheet'
				/>
			</head>
			<body>
				<a
					className={styles['skip-link']}
					href='#main-content'>
					{language === 'es' ? 'Saltar al contenido' : 'Skip to main content'}
				</a>
				{children}
				<script
					src='./client.js'
					type='module'
				/>
				{developmentMode && (
					<script
						src='./__dev/reload.js'
						type='module'
					/>
				)}
			</body>
		</html>
	);
}

function WebPage({
	developmentMode = false,
	language,
	settings = DEFAULT_APP_SHELL_SETTINGS,
}: WebPageProps): ReactElement {
	return (
		<Document
			developmentMode={developmentMode}
			language={language}
			settings={settings}>
			<div
				data-application-name={settings.applicationName}
				data-language={language}
				data-show-logo={String(settings.showLogo)}
				data-show-navigation={String(settings.showNavigation)}
				id='root'>
				<App
					language={language}
					settings={settings}
				/>
			</div>
		</Document>
	);
}

export { Document, WebPage };
