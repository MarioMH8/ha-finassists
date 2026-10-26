import { Button } from '@app/components/button';
import { ICON_NAME } from '@app/components/icon';
import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { EmptyState } from './empty-state';

describe('EmptyState', () => {
	test('renders the heading, icon, description and action', () => {
		const markup = renderToStaticMarkup(
			<EmptyState
				action={<Button type='button'>Add the first item</Button>}
				icon={ICON_NAME.WALLET}
				title='Nothing yet'>
				Add an item to get started.
			</EmptyState>
		);

		expect(markup).toContain('<h2');
		expect(markup).toContain('Nothing yet');
		expect(markup).toContain('<svg');
		expect(markup).toContain('Add an item to get started.');
		expect(markup).toContain('Add the first item');
	});

	test('renders only the heading when the optional parts are omitted', () => {
		const markup = renderToStaticMarkup(<EmptyState title='Nothing yet' />);

		expect(markup).toContain('<h2');
		expect(markup).toContain('Nothing yet');
		expect(markup).not.toContain('<svg');
		expect(markup).not.toContain('<p');
		expect(markup).not.toContain('<button');
	});
});
