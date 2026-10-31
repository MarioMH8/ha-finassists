import { DEFAULT_FEATURE_FLAGS, DEFAULT_SHELL_CONFIG } from '@modules/shell/domain';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { WebPage } from './document';

describe('WebPage', () => {
	test('serializes the UI flags for hydration and applies them to the tree', () => {
		const markup = renderToStaticMarkup(
			<WebPage
				language='en'
				settings={{
					...DEFAULT_SHELL_CONFIG,
					features: {
						...DEFAULT_FEATURE_FLAGS,
						ui: {
							...DEFAULT_FEATURE_FLAGS.ui,
							administration: false,
							monthSummaryChart: false,
						},
					},
				}}
			/>
		);

		expect(markup).toContain('data-feature-administration="false"');
		expect(markup).toContain('data-feature-month-summary-chart="false"');
		expect(markup).not.toContain('>Administration<');
		expect(markup).not.toContain('aria-label="Show chart"');
	});
});
