import type { Database } from 'bun:sqlite';

import type { ApiTokenRepository } from '../../domain';
import { ApiToken } from '../../domain';

interface TokenRow {
	created_at: string;
	id: string;
	name: string;
	owner_id: string;
	secret_hash: string;
	token_prefix: string;
}

export class SqliteApiTokenRepository implements ApiTokenRepository {
	constructor(private readonly database: Database) {}

	async deleteByIdAndOwner(id: string, ownerId: string): Promise<boolean> {
		const result = this.database.query('DELETE FROM api_tokens WHERE id = ? AND owner_id = ?').run(id, ownerId);
		await Promise.resolve();

		return result.changes > 0;
	}

	async findAllByOwner(ownerId: string): Promise<ApiToken[]> {
		const rows = this.database
			.query(
				'SELECT id, owner_id, name, token_prefix, secret_hash, created_at FROM api_tokens WHERE owner_id = ? ORDER BY created_at DESC'
			)
			.all(ownerId) as TokenRow[];

		const tokens = rows.map(row => this.toApiToken(row));
		await Promise.resolve();

		return tokens;
	}

	async findByHash(hash: string): Promise<ApiToken | undefined> {
		const row = this.database
			.query(
				'SELECT id, owner_id, name, token_prefix, secret_hash, created_at FROM api_tokens WHERE secret_hash = ?'
			)
			.get(hash) as TokenRow | undefined;

		const token = row ? this.toApiToken(row) : undefined;
		await Promise.resolve();

		return token;
	}

	async save(token: ApiToken): Promise<void> {
		this.database
			.query(
				`INSERT INTO api_tokens (id, owner_id, name, token_prefix, secret_hash, created_at)
				 VALUES (?, ?, ?, ?, ?, ?)`
			)
			.run(token.id, token.ownerId, token.name, token.prefix, token.secretHash, token.createdAt);
		await Promise.resolve();
	}

	private toApiToken(row: TokenRow): ApiToken {
		return ApiToken.create({
			createdAt: row.created_at,
			id: row.id,
			name: row.name,
			ownerId: row.owner_id,
			prefix: row.token_prefix,
			secretHash: row.secret_hash,
		});
	}
}
