import { describe, expect, it } from 'bun:test';

import { DEFAULT_TRUSTED_INGRESS_IP, resolveIngressActor } from './resolve-ingress-actor';

describe('resolveIngressActor', () => {
	it('uses the stable Home Assistant user ID', () => {
		const actor = resolveIngressActor(
			new Headers({
				'X-Remote-User-Display-Name': 'Mario',
				'X-Remote-User-Id': 'user-123',
				'X-Remote-User-Name': 'mario',
			}),
			'172.30.32.2',
			'172.30.32.2'
		);

		expect(actor).toEqual({
			displayName: 'Mario',
			id: 'user-123',
			kind: 'home_assistant_user',
			username: 'mario',
		});
	});

	it('does not infer an identity from names when the stable ID is missing', () => {
		const actor = resolveIngressActor(
			new Headers({
				'X-Remote-User-Display-Name': 'Mario',
				'X-Remote-User-Name': 'mario',
			}),
			'172.30.32.2',
			'172.30.32.2'
		);

		expect(actor).toEqual({ kind: 'unknown' });
	});

	it('does not trust identity headers from an untrusted peer', () => {
		expect(
			resolveIngressActor(
				new Headers({ 'X-Remote-User-Id': 'spoofed-user' }),
				'172.30.33.8',
				DEFAULT_TRUSTED_INGRESS_IP
			)
		).toEqual({ kind: 'unknown' });
	});

	it('treats a blank stable ID as unknown', () => {
		expect(resolveIngressActor(new Headers({ 'X-Remote-User-Id': '  ' }), '172.30.32.2', '172.30.32.2')).toEqual({
			kind: 'unknown',
		});
	});
});
