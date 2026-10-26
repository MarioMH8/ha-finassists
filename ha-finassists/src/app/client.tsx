import { LANGUAGE } from '@app/i18n/language';
import { App } from '@app/shell/app';
import { clearIngressFrameOutline } from '@app/shell/ingress-frame';
import { DEFAULT_SHELL_CONFIG } from '@modules/shell/domain';
import { hydrateRoot } from 'react-dom/client';

const rootElement = document.querySelector('#root');
const language = rootElement?.getAttribute('data-language') === LANGUAGE.SPANISH ? LANGUAGE.SPANISH : LANGUAGE.ENGLISH;
const settings = {
	applicationName: rootElement?.getAttribute('data-application-name') ?? DEFAULT_SHELL_CONFIG.applicationName,
	currencyCode: rootElement?.getAttribute('data-currency-code') ?? DEFAULT_SHELL_CONFIG.currencyCode,
};

if (rootElement) {
	hydrateRoot(
		rootElement,
		<App
			language={language}
			settings={settings}
		/>
	);
	// Home Assistant can focus the Ingress iframe while mounting the page.
	clearIngressFrameOutline();
}
