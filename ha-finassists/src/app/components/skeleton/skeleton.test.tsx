import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { LoadingStatus, Skeleton, SkeletonTableBody } from './skeleton';

describe('Skeleton', () => {
	test('hides the placeholder from assistive technology', () => {
		const markup = renderToStaticMarkup(<Skeleton />);

		expect(markup).toContain('aria-hidden="true"');
		expect(markup).toContain('data-skeleton="text"');
	});

	test('keeps the requested shape', () => {
		expect(renderToStaticMarkup(<Skeleton shape='circle' />)).toContain('data-skeleton="circle"');
	});
});

describe('SkeletonTableBody', () => {
	test('fills one placeholder per cell', () => {
		const markup = renderToStaticMarkup(
			<table>
				<SkeletonTableBody
					columns={4}
					rows={3}
				/>
			</table>
		);

		expect(markup.match(/<tr>/g) ?? []).toHaveLength(3);
		expect(markup.match(/data-skeleton="text"/g) ?? []).toHaveLength(12);
	});

	test('defaults to six rows', () => {
		const markup = renderToStaticMarkup(
			<table>
				<SkeletonTableBody columns={2} />
			</table>
		);

		expect(markup.match(/<tr>/g) ?? []).toHaveLength(6);
	});
});

describe('LoadingStatus', () => {
	test('announces the wait as a quiet status', () => {
		const markup = renderToStaticMarkup(<LoadingStatus label='Loading transactions…' />);

		expect(markup).toContain('role="status"');
		expect(markup).toContain('Loading transactions…');
	});
});

describe('skeleton animations', () => {
	test('uses keyframes declared outside the CSS module', async () => {
		const module = await Bun.file(new URL('skeleton.module.css', import.meta.url)).text();
		const shared = await Bun.file(new URL('../../styles/global.css', import.meta.url)).text();

		for (const name of ['ha-skeleton-reveal', 'ha-skeleton-pulse']) {
			expect(module).toContain(name);
			expect(shared).toContain(`@keyframes ${name}`);
		}

		expect(module).not.toContain('@keyframes');
	});
});
