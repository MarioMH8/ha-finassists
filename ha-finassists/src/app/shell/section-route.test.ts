import { describe, expect, test } from 'bun:test';

import { DEFAULT_SECTION, formatSectionHash, parseSectionHash, SECTION } from './section-route';

describe('section route', () => {
	test('parses known section hashes', () => {
		expect(parseSectionHash('#/administration')).toBe(SECTION.ADMINISTRATION);
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
});
