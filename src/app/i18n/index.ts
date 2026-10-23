import type { Language } from './language';
import english from './locales/en.json';
import spanish from './locales/es.json';

const translations: Record<Language, typeof english> = {
	en: english,
	es: spanish,
};

type Copy = typeof english;

function getCopy(language: Language): Copy {
	return translations[language];
}

function formatTokenCount(count: number, language: Language): string {
	const translationsForCount = translations[language].tokenCount;
	const pluralCategory = new Intl.PluralRules(language).select(count);
	const template = pluralCategory === 'one' ? translationsForCount.one : translationsForCount.other;

	return template.replace('{count}', () => String(count));
}

export { type Copy, formatTokenCount, getCopy };
