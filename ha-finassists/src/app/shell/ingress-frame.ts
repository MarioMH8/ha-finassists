/*
 * Home Assistant draws a focus-visible outline around the Ingress iframe when
 * the frame itself holds focus. The frame cannot style its own parent across a
 * cross-origin boundary, so this module clears the outline only when the parent
 * document is reachable and the frame that hosts this document can be found.
 */
interface IngressFrame {
	contentWindow: unknown;
	style: {
		outline: string;
		outlineOffset: string;
	};
}

interface IngressFrameHost {
	frameElement: unknown;
	parent: {
		document: {
			querySelectorAll(selector: 'iframe'): Iterable<IngressFrame>;
		};
	};
}

const INGRESS_FRAME_OUTLINE = 'none';
const INGRESS_FRAME_OUTLINE_OFFSET = '0';

function clearFrameOutline(frame: IngressFrame): void {
	frame.style.outline = INGRESS_FRAME_OUTLINE;
	frame.style.outlineOffset = INGRESS_FRAME_OUTLINE_OFFSET;
}

function removeFrameOutline(frames: Iterable<IngressFrame>, frameWindow: object): void {
	const frame = [...frames].find(candidate => candidate.contentWindow === frameWindow);
	if (frame) {
		clearFrameOutline(frame);
	}
}

function isIngressFrame(candidate: unknown): candidate is IngressFrame {
	return typeof candidate === 'object' && candidate !== null && 'contentWindow' in candidate && 'style' in candidate;
}

/*
 * `Window.frameElement` is the primary path: it returns the iframe that hosts
 * this document even when Home Assistant renders that iframe inside shadow
 * roots, and Ingress is same-origin so the reference is accessible. The parent
 * document query remains a best-effort fallback for browsers that hide it.
 */
function clearHostFrameOutline(frameWindow: IngressFrameHost): void {
	try {
		const frameElement = frameWindow.frameElement;
		if (isIngressFrame(frameElement)) {
			clearFrameOutline(frameElement);

			return;
		}
		removeFrameOutline(frameWindow.parent.document.querySelectorAll('iframe'), frameWindow);
	} catch {
		// A cross-origin parent or a navigated frame cannot be styled from here.
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
	clearHostFrameOutline(frameWindow);
}

export {
	clearFrameOutline,
	clearHostFrameOutline,
	clearIngressFrameOutline,
	type IngressFrame,
	type IngressFrameHost,
	removeFrameOutline,
};
