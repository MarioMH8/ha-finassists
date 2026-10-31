import type { CapabilityFeatureFlags, FeatureFlags, UiFeatureFlags } from '@modules/shell/domain';
import { DEFAULT_FEATURE_FLAGS } from '@modules/shell/domain';
import { describe, expect, test } from 'bun:test';

import {
	DEFAULT_SECTION,
	formatSectionHash,
	parseSectionHash,
	SECTION,
	SECTIONS,
	visibleSections,
} from './section-route';

function features(ui: Partial<UiFeatureFlags> = {}, capabilities: Partial<CapabilityFeatureFlags> = {}): FeatureFlags {
	return {
		capabilities: { ...DEFAULT_FEATURE_FLAGS.capabilities, ...capabilities },
		ui: { ...DEFAULT_FEATURE_FLAGS.ui, ...ui },
	};
}

describe('section route', () => {
	test('parses known section hashes', () => {
		expect(parseSectionHash('#/administration')).toBe(SECTION.ADMINISTRATION);
		expect(parseSectionHash('#/scheduled')).toBe(SECTION.SCHEDULED);
		expect(parseSectionHash('#/transactions')).toBe(SECTION.TRANSACTIONS);
		expect(parseSectionHash('#administration')).toBe(SECTION.ADMINISTRATION);
	});

	test('falls back to the default section for empty or unknown hashes', () => {
		expect(parseSectionHash('')).toBe(DEFAULT_SECTION);
		expect(parseSectionHash('#/unknown')).toBe(DEFAULT_SECTION);
	});

	test('formats a section as a hash that parses back to it', () => {
		expect(formatSectionHash(SECTION.ADMINISTRATION)).toBe('#/administration');
		expect(parseSectionHash(formatSectionHash(SECTION.ADMINISTRATION))).toBe(SECTION.ADMINISTRATION);
	});

	test('filters out a hidden section and keeps the remaining order', () => {
		expect(visibleSections(features())).toEqual(SECTIONS);
		expect(visibleSections(features({ administration: false }))).toEqual([
			SECTION.TRANSACTIONS,
			SECTION.SCHEDULED,
			SECTION.CATEGORIES,
		]);
		expect(visibleSections(features({}, { scheduledTransactions: false }))).toEqual([
			SECTION.TRANSACTIONS,
			SECTION.CATEGORIES,
			SECTION.ADMINISTRATION,
		]);
	});

	test('falls back to the first visible section for a hidden hash', () => {
		const sections = visibleSections(features({ administration: false }, { scheduledTransactions: false }));

		expect(parseSectionHash('#/administration', sections)).toBe(SECTION.TRANSACTIONS);
		expect(parseSectionHash('#/scheduled', sections)).toBe(SECTION.TRANSACTIONS);
		expect(parseSectionHash('#/categories', sections)).toBe(SECTION.CATEGORIES);
	});
});
