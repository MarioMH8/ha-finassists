import { describe, expect, test } from 'bun:test';

import { clearIngressFrameOutline, removeFrameOutline } from './ingress-frame';

function createFrame(outline = '2px solid') {
	return {
		contentWindow: null as null | Window,
		style: { outline, outlineOffset: '2px' },
	};
}

describe('ingress frame outline', () => {
	test('clears the outline of the iframe that hosts this document', () => {
		const frameWindow = {} as Window;
		const otherFrame = createFrame('2px solid');
		const ingressFrame = createFrame('2px solid');
		ingressFrame.contentWindow = frameWindow;

		removeFrameOutline([otherFrame, ingressFrame], frameWindow);
		expect(ingressFrame.style.outline).toBe('none');
		expect(ingressFrame.style.outlineOffset).toBe('0');
		expect(otherFrame.style.outline).toBe('2px solid');
	});

	test('leaves every frame untouched when none hosts this document', () => {
		const frameWindow = {} as Window;
		const frame = createFrame();

		removeFrameOutline([frame], frameWindow);
		expect(frame.style.outline).toBe('2px solid');
		expect(frame.style.outlineOffset).toBe('2px');
	});

	test('is a no-op without a parent document', () => {
		expect(() => clearIngressFrameOutline()).not.toThrow();
	});
});
