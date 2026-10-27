import { DatabaseMigrator } from '@modules/storage/infrastructure';
import {
	AuthenticateSystemCredential,
	ExchangeSystemCredential,
	RevokeSystemCredential,
	RotateSystemCredential,
} from '@modules/system-credentials/application';
import { WebCryptoSystemCredentialService } from '@modules/system-credentials/infrastructure/services/web-crypto-system-credential.service';
import { Database } from 'bun:sqlite';
import { afterEach, describe, expect, it } from 'bun:test';

import { SqliteSystemCredentialRepository } from './sqlite-system-credential.repository';

describe('SqliteSystemCredentialRepository', () => {
	let database: Database;

	afterEach(() => database.close());

	function setup(now = new Date('2025-02-01T00:00:00.000Z')) {
		database = new Database(':memory:');
		DatabaseMigrator.migrate(database);
		const repository = new SqliteSystemCredentialRepository(database);
		const service = new WebCryptoSystemCredentialService();
		const useCases = {
			authenticate: new AuthenticateSystemCredential(repository, service),
			exchange: new ExchangeSystemCredential(repository, service, () => now),
			revoke: new RevokeSystemCredential(repository, service),
			rotate: new RotateSystemCredential(repository, service, () => now),
		};

		return { repository, service, useCases };
	}

	it('exchanges a bootstrap capability once and stores only hashes', async () => {
		const { repository, service, useCases } = setup();
		const capability = 'a-long-random-bootstrap-capability-value';
		repository.configureBootstrapCapability(await service.hash(capability), '2025-02-02T00:00:00.000Z');

		const issued = await useCases.exchange.execute(capability);

		expect(issued?.id).toBe('home-assistant-integration');
		expect(issued?.credential.startsWith('fa_system_')).toBe(true);
		expect(await useCases.authenticate.execute(issued?.credential ?? '')).toMatchObject({
			id: 'home-assistant-integration',
		});
		expect(await useCases.exchange.execute(capability)).toBeUndefined();
		expect(database.query('SELECT secret_hash FROM system_credentials').get()).toMatchObject({
			secret_hash: await service.hash(issued?.credential ?? ''),
		});
		expect(database.query('SELECT secret_hash FROM system_credential_bootstrap').get()).toMatchObject({
			secret_hash: await service.hash(capability),
		});
	});

	it('does not replace discovery capability while an integration credential is active', async () => {
		const { repository, service, useCases } = setup();
		const capability = 'active-integration-bootstrap-capability';
		repository.configureBootstrapCapability(await service.hash(capability), '2025-02-02T00:00:00.000Z');
		const issued = await useCases.exchange.execute(capability);
		if (!issued) {
			throw new Error('Expected the bootstrap capability to be exchanged');
		}

		const replacement = 'replacement-bootstrap-capability-after-restart';
		expect(
			repository.configureBootstrapCapability(await service.hash(replacement), '2025-02-02T00:00:00.000Z')
		).toBe(false);
		expect(await useCases.exchange.execute(replacement)).toBeUndefined();
		expect(await useCases.authenticate.execute(issued.credential)).toMatchObject({
			id: 'home-assistant-integration',
		});
	});

	it('allows only one concurrent redemption and enforces bootstrap expiry', async () => {
		const { repository, service, useCases } = setup();
		const capability = 'another-long-random-bootstrap-capability';
		repository.configureBootstrapCapability(await service.hash(capability), '2025-02-02T00:00:00.000Z');

		const redeemed = await Promise.all([
			useCases.exchange.execute(capability),
			useCases.exchange.execute(capability),
		]);
		expect(redeemed.filter(Boolean)).toHaveLength(1);

		const expired = 'expired-long-random-bootstrap-capability';
		repository.configureBootstrapCapability(await service.hash(expired), '2025-01-31T23:59:59.000Z');
		expect(await useCases.exchange.execute(expired)).toBeUndefined();
	});

	it('rotates and revokes the credential without leaving the old secret valid', async () => {
		const { repository, service, useCases } = setup();
		const capability = 'credential-lifecycle-bootstrap-capability';
		repository.configureBootstrapCapability(await service.hash(capability), '2025-02-02T00:00:00.000Z');
		const issued = await useCases.exchange.execute(capability);
		if (!issued) {
			throw new Error('Expected the bootstrap capability to be exchanged');
		}

		const rotated = await useCases.rotate.execute(issued.credential);
		if (!rotated) {
			throw new Error('Expected the current credential to be rotated');
		}
		expect(await useCases.authenticate.execute(issued.credential)).toBeUndefined();
		expect(await useCases.authenticate.execute(rotated.credential)).toMatchObject({
			id: 'home-assistant-integration',
		});
		expect(await useCases.revoke.execute(issued.credential)).toBe(false);
		expect(await useCases.revoke.execute(rotated.credential)).toBe(true);
		expect(await useCases.authenticate.execute(rotated.credential)).toBeUndefined();
	});
});
