import { describe, expect, test } from 'bun:test';

import { clearHostFrameOutline, clearIngressFrameOutline, removeFrameOutline } from './ingress-frame';

function createFrame(contentWindow: unknown = null, outline = '2px solid') {
	return { contentWindow, style: { outline, outlineOffset: '2px' } };
}

describe('ingress frame outline', () => {
	test('clears the hosting frame through frameElement', () => {
		const ingressFrame = createFrame();
		let didQueryFallback = false;

		clearHostFrameOutline({
			frameElement: ingressFrame,
			parent: {
				document: {
					querySelectorAll: () => {
						didQueryFallback = true;

						return [];
					},
				},
			},
		});

		expect(ingressFrame.style.outline).toBe('none');
		expect(ingressFrame.style.outlineOffset).toBe('0');
		expect(didQueryFallback).toBe(false);
	});

	test('falls back to the parent document iframe query', () => {
		const queriedSelectors: string[] = [];
		let frames: ReturnType<typeof createFrame>[] = [];
		const host = {
			frameElement: null,
			parent: {
				document: {
					querySelectorAll: (selector: string) => {
						queriedSelectors.push(selector);

						return frames;
					},
				},
			},
		};
		const otherFrame = createFrame();
		const ingressFrame = createFrame(host);
		frames = [otherFrame, ingressFrame];

		clearHostFrameOutline(host);

		expect(queriedSelectors).toEqual(['iframe']);
		expect(ingressFrame.style.outline).toBe('none');
		expect(otherFrame.style.outline).toBe('2px solid');
	});

	test('leaves frames untouched when the fallback has no match', () => {
		const frame = createFrame();

		removeFrameOutline([frame], {});

		expect(frame.style.outline).toBe('2px solid');
		expect(frame.style.outlineOffset).toBe('2px');
	});

	test('ignores an unreachable parent document', () => {
		const host = {
			frameElement: null,
			get parent(): never {
				throw new Error('cross-origin');
			},
		};

		expect(() => clearHostFrameOutline(host)).not.toThrow();
	});

	test('is a no-op without a parent document', () => {
		expect(() => clearIngressFrameOutline()).not.toThrow();
	});
});
