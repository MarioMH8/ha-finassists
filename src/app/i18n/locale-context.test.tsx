import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { LocaleProvider, useLocale } from './locale-context';

function LocaleLabel() {
	const { copy, language } = useLocale();

	return <span lang={language}>{copy.tokensTitle}</span>;
}

describe('LocaleProvider', () => {
	test('provides the request language and translations to its subtree', () => {
		const markup = renderToStaticMarkup(
			<LocaleProvider language='es'>
				<LocaleLabel />
			</LocaleProvider>
		);

		expect(markup).toContain('lang="es"');
		expect(markup).toContain('Tokens de API');
	});
});
