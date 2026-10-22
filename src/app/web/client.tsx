import { hydrateRoot } from 'react-dom/client';

import { App } from './app';
import { LANGUAGE } from './language';

const rootElement = document.querySelector('#root');
const language = rootElement?.getAttribute('data-language') === LANGUAGE.SPANISH ? LANGUAGE.SPANISH : LANGUAGE.ENGLISH;

if (rootElement) {
	hydrateRoot(rootElement, <App language={language} />);
}
