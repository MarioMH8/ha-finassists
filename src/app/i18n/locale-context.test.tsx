import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { getCopy, interpolate } from '.';
import { LocaleProvider, useLocale } from './locale-context';
import english from './locales/en.json';
import spanish from './locales/es.json';

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

describe('translations', () => {
	test('define the same keys in English and Spanish', () => {
		expect(Object.keys(spanish).toSorted((a, b) => a.localeCompare(b))).toEqual(
			Object.keys(english).toSorted((a, b) => a.localeCompare(b))
		);
	});

	test('provide localized transaction copy', () => {
		expect(getCopy('en').transactionSubmit).toBe('Add transaction');
		expect(getCopy('es').transactionSubmit).toBe('Añadir transacción');
	});

	test('interpolate named placeholders and keep unknown ones', () => {
		expect(interpolate('{shown} of {total} {unknown}', { shown: 2, total: 5 })).toBe('2 of 5 {unknown}');
	});
});
