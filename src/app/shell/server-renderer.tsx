import '../styles/global.css';

import type { Language } from '@app/i18n/language';
import type { AppShellSettings } from '@modules/app-configuration/domain';
import { createElement } from 'react';
import { renderToReadableStream } from 'react-dom/server';

import { WebPage } from './document';

async function renderPage(
	language: Language,
	isDevelopmentMode: boolean,
	settings: AppShellSettings
): Promise<ReadableStream<Uint8Array>> {
	return renderToReadableStream(createElement(WebPage, { developmentMode: isDevelopmentMode, language, settings }));
}

export { renderPage };
