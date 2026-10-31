import type { Language } from '@app/i18n/language';
import type { ShellConfig } from '@modules/shell/domain';
import { DEFAULT_SHELL_CONFIG } from '@modules/shell/domain';
import type { ReactElement, ReactNode } from 'react';

import { App } from './app';
import styles from './document.module.css';
import { ShellSettings } from './settings';

interface DocumentProps {
	children: ReactNode;
	developmentMode: boolean;
	language: Language;
	settings: ShellConfig;
}

interface WebPageProps {
	developmentMode?: boolean;
	language: Language;
	settings?: ShellConfig;
}

function Document({ children, developmentMode, language, settings }: DocumentProps): ReactElement {
	return (
		<html lang={language}>
			<head>
				<meta charSet='utf-8' />
				<meta
					content='width=device-width, initial-scale=1, viewport-fit=cover'
					name='viewport'
				/>
				<meta
					content='#009ac7'
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

function WebPage({ developmentMode = false, language, settings = DEFAULT_SHELL_CONFIG }: WebPageProps): ReactElement {
	return (
		<Document
			developmentMode={developmentMode}
			language={language}
			settings={settings}>
			<div
				{...ShellSettings.toFeatureAttributes(settings.features)}
				data-application-name={settings.applicationName}
				data-currency-code={settings.currencyCode}
				data-language={language}
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
