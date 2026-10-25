import { SystemCredentialMother } from '@modules/system-credentials/domain/system-credential.mother';
import { SystemCredentialSecretMother } from '@modules/system-credentials/domain/system-credential-secret.mother';
import { MockSystemCredentialRepository } from '@modules/system-credentials/infrastructure/repositories/mock-system-credential.repository';
import { MockSystemCredentialService } from '@modules/system-credentials/infrastructure/services/mock-system-credential.service';
import { describe, expect, it } from 'bun:test';

import {
	AuthenticateSystemCredential,
	ExchangeSystemCredential,
	RevokeSystemCredential,
	RotateSystemCredential,
	SYSTEM_CREDENTIAL_ID,
} from './system-credential-lifecycle';

const NOW = new Date('2026-03-04T05:06:07.000Z');
const now = (): Date => NOW;

describe('ExchangeSystemCredential', () => {
	describe('execute', () => {
		it('should issue a new credential when the bootstrap capability is redeemed', async () => {
			const repository = new MockSystemCredentialRepository();
			const credentials = new MockSystemCredentialService();
			const secret = SystemCredentialSecretMother.create();
			credentials.shouldCreate(secret);
			credentials.shouldHash('fa_bootstrap_capability', 'hash:capability');
			repository.shouldExchangeBootstrapCapability(true);

			const issued = await new ExchangeSystemCredential(repository, credentials, now).execute(
				'fa_bootstrap_capability'
			);

			expect(issued).toEqual({ credential: secret.secret, id: SYSTEM_CREDENTIAL_ID });
			credentials.assertHashHasBeenCalledWith('fa_bootstrap_capability');
			repository.assertExchangeBootstrapCapabilityHasBeenCalledWith(
				'hash:capability',
				SystemCredentialMother.create({
					createdAt: NOW.toISOString(),
					prefix: secret.prefix,
					secretHash: secret.hash,
				}),
				NOW.toISOString()
			);
		});

		it('should return undefined when the bootstrap capability is not redeemed', async () => {
			const repository = new MockSystemCredentialRepository();
			const credentials = new MockSystemCredentialService();
			credentials.shouldCreate(SystemCredentialSecretMother.create());
			credentials.shouldHash('fa_bootstrap_capability', 'hash:capability');
			repository.shouldExchangeBootstrapCapability(false);

			const issued = await new ExchangeSystemCredential(repository, credentials, now).execute(
				'fa_bootstrap_capability'
			);

			expect(issued).toBeUndefined();
		});

		it('should use the current time by default', async () => {
			const repository = new MockSystemCredentialRepository();
			const credentials = new MockSystemCredentialService();
			const secret = SystemCredentialSecretMother.create();
			credentials.shouldCreate(secret);
			credentials.shouldHash('fa_bootstrap_capability', 'hash:capability');
			repository.shouldExchangeBootstrapCapability(true);
			const before = Date.now();

			const issued = await new ExchangeSystemCredential(repository, credentials).execute(
				'fa_bootstrap_capability'
			);

			expect(issued?.credential).toBe(secret.secret);
			expect(Date.now()).toBeGreaterThanOrEqual(before);
		});
	});
});

describe('RotateSystemCredential', () => {
	describe('execute', () => {
		it('should issue a replacement credential when the current one is rotated', async () => {
			const repository = new MockSystemCredentialRepository();
			const credentials = new MockSystemCredentialService();
			const secret = SystemCredentialSecretMother.create({
				hash: 'hash:new',
				prefix: 'fa_sys_new',
				secret: 'fa_sys_new_secret',
			});
			credentials.shouldCreate(secret);
			credentials.shouldHash('fa_sys_current', 'hash:current');
			repository.shouldRotate(true);

			const issued = await new RotateSystemCredential(repository, credentials, now).execute('fa_sys_current');

			expect(issued).toEqual({ credential: 'fa_sys_new_secret', id: SYSTEM_CREDENTIAL_ID });
			credentials.assertHashHasBeenCalledWith('fa_sys_current');
			repository.assertRotateHasBeenCalledWith(
				'hash:current',
				SystemCredentialMother.create({
					createdAt: NOW.toISOString(),
					prefix: 'fa_sys_new',
					secretHash: 'hash:new',
				})
			);
		});

		it('should return undefined when the current credential is not rotated', async () => {
			const repository = new MockSystemCredentialRepository();
			const credentials = new MockSystemCredentialService();
			credentials.shouldCreate(SystemCredentialSecretMother.create());
			credentials.shouldHash('fa_sys_current', 'hash:current');
			repository.shouldRotate(false);

			const issued = await new RotateSystemCredential(repository, credentials, now).execute('fa_sys_current');

			expect(issued).toBeUndefined();
		});

		it('should use the current time by default', async () => {
			const repository = new MockSystemCredentialRepository();
			const credentials = new MockSystemCredentialService();
			credentials.shouldCreate(SystemCredentialSecretMother.create());
			credentials.shouldHash('fa_sys_current', 'hash:current');
			repository.shouldRotate(true);

			const issued = await new RotateSystemCredential(repository, credentials).execute('fa_sys_current');

			expect(issued?.id).toBe(SYSTEM_CREDENTIAL_ID);
		});
	});
});

describe('AuthenticateSystemCredential', () => {
	describe('execute', () => {
		it('should return the credential matching the hashed secret', async () => {
			const repository = new MockSystemCredentialRepository();
			const credentials = new MockSystemCredentialService();
			const credential = SystemCredentialMother.create();
			credentials.shouldHash('fa_sys_secret', 'hash:secret');
			repository.shouldAuthenticate(credential);

			const authenticated = await new AuthenticateSystemCredential(repository, credentials).execute(
				'fa_sys_secret'
			);

			expect(authenticated).toEqual(credential);
			repository.assertAuthenticateHasBeenCalledWith('hash:secret');
		});

		it('should return undefined when no credential matches', async () => {
			const repository = new MockSystemCredentialRepository();
			const credentials = new MockSystemCredentialService();
			credentials.shouldHash('fa_sys_secret', 'hash:secret');
			repository.shouldAuthenticate(undefined);

			const authenticated = await new AuthenticateSystemCredential(repository, credentials).execute(
				'fa_sys_secret'
			);

			expect(authenticated).toBeUndefined();
			repository.assertAuthenticateHasBeenCalledWith('hash:secret');
		});
	});
});

describe('RevokeSystemCredential', () => {
	describe('execute', () => {
		it('should return true when the credential is revoked', async () => {
			const repository = new MockSystemCredentialRepository();
			const credentials = new MockSystemCredentialService();
			credentials.shouldHash('fa_sys_secret', 'hash:secret');
			repository.shouldRevoke(true);

			const isRevoked = await new RevokeSystemCredential(repository, credentials).execute('fa_sys_secret');

			expect(isRevoked).toBe(true);
			repository.assertRevokeHasBeenCalledWith('hash:secret');
		});

		it('should return false when the credential does not exist', async () => {
			const repository = new MockSystemCredentialRepository();
			const credentials = new MockSystemCredentialService();
			credentials.shouldHash('fa_sys_secret', 'hash:secret');
			repository.shouldRevoke(false);

			const isRevoked = await new RevokeSystemCredential(repository, credentials).execute('fa_sys_secret');

			expect(isRevoked).toBe(false);
			repository.assertRevokeHasBeenCalledWith('hash:secret');
		});
	});
});
