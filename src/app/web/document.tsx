import type { ReactElement, ReactNode } from 'react';

import { App } from './app';
import type { Language } from './language';

interface DocumentProps {
	children: ReactNode;
	language: Language;
}

interface WebPageProps {
	language: Language;
}

function Document({ children, language }: DocumentProps): ReactElement {
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
					className='skip-link'
					href='#main-content'>
					{language === 'es' ? 'Saltar al contenido' : 'Skip to main content'}
				</a>
				{children}
				<script
					src='./client.js'
					type='module'
				/>
			</body>
		</html>
	);
}

function WebPage({ language }: WebPageProps): ReactElement {
	return (
		<Document language={language}>
			<div
				data-language={language}
				id='root'>
				<App language={language} />
			</div>
		</Document>
	);
}

export { Document, WebPage };
