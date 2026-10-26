import { useCallback, useSyncExternalStore } from 'react';

const SECTION = {
	ADMINISTRATION: 'administration',
	CATEGORIES: 'categories',
	TRANSACTIONS: 'transactions',
} as const;

type Section = (typeof SECTION)[keyof typeof SECTION];

const SECTIONS: readonly Section[] = [SECTION.TRANSACTIONS, SECTION.CATEGORIES, SECTION.ADMINISTRATION];
const DEFAULT_SECTION: Section = SECTION.TRANSACTIONS;

function parseSectionHash(hash: string): Section {
	const name = hash.replace(/^#\/?/, '');

	return SECTIONS.find(section => section === name) ?? DEFAULT_SECTION;
}

function formatSectionHash(section: Section): string {
	return `#/${section}`;
}

function subscribe(onChange: () => void): () => void {
	addEventListener('hashchange', onChange);

	return () => {
		removeEventListener('hashchange', onChange);
	};
}

/*
 * The hash is the only routing state that survives inside the Ingress iframe
 * without server fallbacks or prefix-aware asset URLs.
 */
function useSectionRoute(): [Section, (section: Section) => void] {
	const section = useSyncExternalStore(
		subscribe,
		() => parseSectionHash(location.hash),
		() => DEFAULT_SECTION
	);
	const setSection = useCallback((next: Section) => {
		location.hash = formatSectionHash(next);
	}, []);

	return [section, setSection];
}

export { DEFAULT_SECTION, formatSectionHash, parseSectionHash, SECTION, type Section, SECTIONS, useSectionRoute };
