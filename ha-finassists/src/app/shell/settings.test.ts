import { DEFAULT_SHELL_CONFIG } from '@modules/shell/domain';
import { describe, expect, test } from 'bun:test';

import type { AttributeSource } from './settings';
import { featureAttributes, readShellSettings } from './settings';

function source(attributes: Record<string, string>): AttributeSource {
	return {
		getAttribute(name: string): null | string {
			return attributes[name] ?? null;
		},
	};
}

describe('readShellSettings', () => {
	test('falls back to the default settings when the root has no attributes', () => {
		expect(readShellSettings(null)).toEqual(DEFAULT_SHELL_CONFIG);
	});

	test('reads explicit feature attributes', () => {
		expect(
			readShellSettings(
				source({
					'data-feature-administration': 'false',
					'data-feature-month-summary': 'true',
					'data-feature-month-summary-chart': 'false',
					'data-feature-scheduled-pending': 'false',
					'data-feature-scheduled-summary': 'true',
				})
			).features
		).toEqual({
			ui: {
				administration: false,
				monthSummary: true,
				monthSummaryChart: false,
				scheduledPending: false,
				scheduledSummary: true,
			},
		});
	});

	test('normalizes the chart off when the summary is hidden', () => {
		expect(
			readShellSettings(
				source({
					'data-feature-month-summary': 'false',
					'data-feature-month-summary-chart': 'true',
				})
			).features.ui
		).toMatchObject({
			monthSummary: false,
			monthSummaryChart: false,
		});
	});

	test('ignores values that are not true or false', () => {
		expect(
			readShellSettings(
				source({
					'data-feature-administration': 'no',
					'data-feature-month-summary': '1',
					'data-feature-scheduled-summary': 'yes',
				})
			).features
		).toEqual(DEFAULT_SHELL_CONFIG.features);
	});
});

describe('featureAttributes', () => {
	test('serializes every UI flag with the same attribute names used for hydration', () => {
		expect(featureAttributes(DEFAULT_SHELL_CONFIG.features)).toEqual({
			'data-feature-administration': 'true',
			'data-feature-month-summary': 'true',
			'data-feature-month-summary-chart': 'true',
			'data-feature-scheduled-pending': 'true',
			'data-feature-scheduled-summary': 'true',
		});
	});
});
