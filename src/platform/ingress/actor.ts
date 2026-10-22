import { isIP } from 'node:net';

const DEFAULT_TRUSTED_INGRESS_IP = '172.30.32.2';

interface HomeAssistantActor {
	displayName?: string;
	id: string;
	kind: 'home_assistant_user';
	username?: string;
}

interface UnknownActor {
	kind: 'unknown';
}

type IngressActor = HomeAssistantActor | UnknownActor;

function readOptionalHeader(headers: Headers, name: string): string | undefined {
	const value = headers.get(name)?.trim();

	return value === '' ? undefined : value;
}

function normalizeAddress(address: string): string {
	const normalized = address.toLowerCase();

	return normalized.startsWith('::ffff:') ? normalized.slice(7) : normalized;
}

function isTrustedIngressPeer(remoteAddress: string | undefined, trustedIngressIp: string): boolean {
	return (
		remoteAddress !== undefined &&
		isIP(remoteAddress) !== 0 &&
		isIP(trustedIngressIp) !== 0 &&
		normalizeAddress(remoteAddress) === normalizeAddress(trustedIngressIp)
	);
}

function resolveIngressActor(
	headers: Headers,
	remoteAddress: string | undefined,
	trustedIngressIp: string
): IngressActor {
	if (!isTrustedIngressPeer(remoteAddress, trustedIngressIp)) {
		return { kind: 'unknown' };
	}

	const id = readOptionalHeader(headers, 'X-Remote-User-Id');
	if (!id) {
		return { kind: 'unknown' };
	}

	const username = readOptionalHeader(headers, 'X-Remote-User-Name');
	const displayName = readOptionalHeader(headers, 'X-Remote-User-Display-Name');

	return {
		id,
		kind: 'home_assistant_user',
		...(username && { username }),
		...(displayName && { displayName }),
	};
}

export { DEFAULT_TRUSTED_INGRESS_IP, type IngressActor, isTrustedIngressPeer, resolveIngressActor };
