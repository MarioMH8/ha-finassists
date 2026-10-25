import type { SystemCredential } from './system-credential';

export class SystemCredentialMother {
	static create(overrides: Partial<SystemCredential> = {}): SystemCredential {
		return {
			createdAt: '2026-01-01T00:00:00.000Z',
			id: 'home-assistant-integration',
			prefix: 'fa_sys_test',
			secretHash: 'hash:fa_sys_test_secret',
			...overrides,
		};
	}
}
