import type { Database } from 'bun:sqlite';

import type { SystemCredential, SystemCredentialRepository } from '../../domain';

interface SystemCredentialRow {
	created_at: string;
	id: string;
	secret_hash: string;
	token_prefix: string;
}

class SqliteSystemCredentialRepository implements SystemCredentialRepository {
	constructor(private readonly database: Database) {}

	async authenticate(secretHash: string): Promise<SystemCredential | undefined> {
		const row = this.database
			.query('SELECT id, token_prefix, secret_hash, created_at FROM system_credentials WHERE secret_hash = ?')
			.get(secretHash) as SystemCredentialRow | undefined;
		await Promise.resolve();

		return row ? this.toCredential(row) : undefined;
	}

	configureBootstrapCapability(secretHash: string, expiresAt: string): boolean {
		const configure = this.database.transaction(() => {
			const credential = this.database.query('SELECT 1 FROM system_credentials LIMIT 1').get();
			if (credential) {
				return false;
			}

			this.database
				.query(
					'INSERT INTO system_credential_bootstrap (id, secret_hash, expires_at, redeemed_at) VALUES (1, ?, ?, NULL) ON CONFLICT(id) DO UPDATE SET secret_hash = excluded.secret_hash, expires_at = excluded.expires_at, redeemed_at = NULL'
				)
				.run(secretHash, expiresAt);

			return true;
		});

		return configure();
	}

	async exchangeBootstrapCapability(
		capabilityHash: string,
		credential: SystemCredential,
		now: string
	): Promise<boolean> {
		const exchange = this.database.transaction(() => {
			const redemption = this.database
				.query(
					'UPDATE system_credential_bootstrap SET redeemed_at = ? WHERE id = 1 AND secret_hash = ? AND expires_at > ? AND redeemed_at IS NULL'
				)
				.run(now, capabilityHash, now);
			if (redemption.changes !== 1) {
				return false;
			}

			this.database
				.query('INSERT INTO system_credentials (id, token_prefix, secret_hash, created_at) VALUES (?, ?, ?, ?)')
				.run(credential.id, credential.prefix, credential.secretHash, credential.createdAt);

			return true;
		});
		const isExchanged = exchange();
		await Promise.resolve();

		return isExchanged;
	}

	async revoke(secretHash: string): Promise<boolean> {
		const result = this.database.query('DELETE FROM system_credentials WHERE secret_hash = ?').run(secretHash);
		await Promise.resolve();

		return result.changes === 1;
	}

	async rotate(currentSecretHash: string, credential: SystemCredential): Promise<boolean> {
		const result = this.database
			.query(
				'UPDATE system_credentials SET token_prefix = ?, secret_hash = ?, created_at = ? WHERE id = ? AND secret_hash = ?'
			)
			.run(credential.prefix, credential.secretHash, credential.createdAt, credential.id, currentSecretHash);
		await Promise.resolve();

		return result.changes === 1;
	}

	private toCredential(row: SystemCredentialRow): SystemCredential {
		return {
			createdAt: row.created_at,
			id: row.id,
			prefix: row.token_prefix,
			secretHash: row.secret_hash,
		};
	}
}

export { SqliteSystemCredentialRepository };
