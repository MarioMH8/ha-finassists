import type { Language } from '@app/i18n/language';
import type { ReactElement, ReactNode } from 'react';

import { App } from './app';
import styles from './document.module.css';

interface DocumentProps {
	children: ReactNode;
	developmentMode: boolean;
	language: Language;
}

interface WebPageProps {
	developmentMode?: boolean;
	language: Language;
}

function Document({ children, developmentMode, language }: DocumentProps): ReactElement {
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
				<title>Fin Assist</title>
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

function WebPage({ developmentMode = false, language }: WebPageProps): ReactElement {
	return (
		<Document
			developmentMode={developmentMode}
			language={language}>
			<div
				data-language={language}
				id='root'>
				<App language={language} />
			</div>
		</Document>
	);
}

export { Document, WebPage };
