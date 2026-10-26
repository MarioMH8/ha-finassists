/*
 * Home Assistant draws a focus-visible outline around the Ingress iframe when
 * the frame itself holds focus. The frame cannot style its own parent across a
 * cross-origin boundary, so this module clears the outline only when the parent
 * document is reachable and contains the frame that hosts this document.
 */
interface IngressFrame {
	contentWindow: null | Window;
	style: {
		outline: string;
		outlineOffset: string;
	};
}

const INGRESS_FRAME_OUTLINE = 'none';
const INGRESS_FRAME_OUTLINE_OFFSET = '0';

function removeFrameOutline(frames: Iterable<IngressFrame>, frameWindow: Window): void {
	const frame = [...frames].find(candidate => candidate.contentWindow === frameWindow);
	if (frame) {
		frame.style.outline = INGRESS_FRAME_OUTLINE;
		frame.style.outlineOffset = INGRESS_FRAME_OUTLINE_OFFSET;
	}
}

function clearIngressFrameOutline(): void {
	if (typeof document === 'undefined') {
		return;
	}
	const frameWindow = document.defaultView;
	if (!frameWindow || frameWindow.parent === frameWindow) {
		return;
	}
	try {
		removeFrameOutline(frameWindow.parent.document.querySelectorAll<HTMLIFrameElement>('iframe'), frameWindow);
	} catch {
		// A cross-origin parent or a navigated frame cannot be styled from here.
	}
}

export { clearIngressFrameOutline, type IngressFrame, removeFrameOutline };
