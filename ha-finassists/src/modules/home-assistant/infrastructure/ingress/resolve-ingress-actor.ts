import { isIP } from 'node:net';

import type { IngressActor } from '@modules/home-assistant/domain';
import { ACTOR_KIND } from '@modules/home-assistant/domain';

const DEFAULT_TRUSTED_INGRESS_IP = '172.30.32.2';

class TrustedIngressPeer {
	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static isTrusted(remoteAddress: string | undefined, trustedIngressIp: string): boolean {
		return (
			remoteAddress !== undefined &&
			isIP(remoteAddress) !== 0 &&
			isIP(trustedIngressIp) !== 0 &&
			this.normalizeAddress(remoteAddress) === this.normalizeAddress(trustedIngressIp)
		);
	}

	private static normalizeAddress(address: string): string {
		const normalized = address.toLowerCase();

		return normalized.startsWith('::ffff:') ? normalized.slice(7) : normalized;
	}
}

class IngressActorResolver {
	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static resolve(headers: Headers, remoteAddress: string | undefined, trustedIngressIp: string): IngressActor {
		if (!TrustedIngressPeer.isTrusted(remoteAddress, trustedIngressIp)) {
			return { kind: ACTOR_KIND.UNKNOWN };
		}

		const id = this.readOptionalHeader(headers, 'X-Remote-User-Id');
		if (!id) {
			return { kind: ACTOR_KIND.UNKNOWN };
		}

		const username = this.readOptionalHeader(headers, 'X-Remote-User-Name');
		const displayName = this.readOptionalHeader(headers, 'X-Remote-User-Display-Name');

		return {
			id,
			kind: ACTOR_KIND.HOME_ASSISTANT_USER,
			...(username && { username }),
			...(displayName && { displayName }),
		};
	}

	private static readOptionalHeader(headers: Headers, name: string): string | undefined {
		const value = headers.get(name)?.trim();

		return value === '' ? undefined : value;
	}
}

export { DEFAULT_TRUSTED_INGRESS_IP, IngressActorResolver, TrustedIngressPeer };
