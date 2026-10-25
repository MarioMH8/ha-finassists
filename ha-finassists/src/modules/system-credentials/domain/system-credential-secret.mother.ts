import type { SystemCredentialSecret } from './system-credential';

export class SystemCredentialSecretMother {
	static create(overrides: Partial<SystemCredentialSecret> = {}): SystemCredentialSecret {
		return {
			hash: 'hash:fa_sys_test_secret',
			prefix: 'fa_sys_test',
			secret: 'fa_sys_test_secret',
			...overrides,
		};
	}
}
