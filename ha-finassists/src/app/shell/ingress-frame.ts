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

function clearHostFrameOutline(frameWindow: IngressFrameHost): void {
	try {
		const frameElement = frameWindow.frameElement;
		if (isIngressFrame(frameElement)) {
			clearFrameOutline(frameElement);

			return;
		}
		removeFrameOutline(frameWindow.parent.document.querySelectorAll('iframe'), frameWindow);
	} catch {
		// The parent is cross-origin or no longer reachable.
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
