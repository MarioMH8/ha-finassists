import type { FeatureFlags } from '@modules/shell/domain';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

const SECTION = {
	ADMINISTRATION: 'administration',
	CATEGORIES: 'categories',
	SCHEDULED: 'scheduled',
	TRANSACTIONS: 'transactions',
} as const;

type Section = (typeof SECTION)[keyof typeof SECTION];

const SECTIONS: readonly Section[] = [
	SECTION.TRANSACTIONS,
	SECTION.SCHEDULED,
	SECTION.CATEGORIES,
	SECTION.ADMINISTRATION,
];
const DEFAULT_SECTION: Section = SECTION.TRANSACTIONS;

const SECTION_VISIBILITY: Record<Section, (features: FeatureFlags) => boolean> = {
	[SECTION.ADMINISTRATION]: features => features.ui.administration,
	[SECTION.CATEGORIES]: () => true,
	[SECTION.SCHEDULED]: () => true,
	[SECTION.TRANSACTIONS]: () => true,
};

function visibleSections(features: FeatureFlags): readonly Section[] {
	return SECTIONS.filter(section => SECTION_VISIBILITY[section](features));
}

function parseSectionHash(hash: string, sections: readonly Section[] = SECTIONS): Section {
	const name = hash.replace(/^#\/?/, '');

	return sections.find(section => section === name) ?? sections[0] ?? DEFAULT_SECTION;
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
function useSectionRoute(sections: readonly Section[] = SECTIONS): [Section, (section: Section) => void] {
	const defaultSection = sections[0] ?? DEFAULT_SECTION;
	const section = useSyncExternalStore(
		subscribe,
		() => parseSectionHash(location.hash, sections),
		() => defaultSection
	);
	const setSection = useCallback((next: Section) => {
		location.hash = formatSectionHash(next);
	}, []);

	useEffect(() => {
		const requested = parseSectionHash(location.hash, SECTIONS);
		if (!sections.includes(requested)) {
			history.replaceState(undefined, '', formatSectionHash(defaultSection));
		}
	}, [defaultSection, sections]);

	return [section, setSection];
}

export {
	DEFAULT_SECTION,
	formatSectionHash,
	parseSectionHash,
	SECTION,
	type Section,
	SECTIONS,
	useSectionRoute,
	visibleSections,
};
