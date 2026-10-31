import { LANGUAGE } from '@app/i18n/language';
import { App } from '@app/shell/app';
import { readShellSettings } from '@app/shell/settings';
import { hydrateRoot } from 'react-dom/client';

const rootElement = document.querySelector('#root');
const language = rootElement?.getAttribute('data-language') === LANGUAGE.SPANISH ? LANGUAGE.SPANISH : LANGUAGE.ENGLISH;
const settings = readShellSettings(rootElement);

if (rootElement) {
	hydrateRoot(
		rootElement,
		<App
			language={language}
			settings={settings}
		/>
	);
}
