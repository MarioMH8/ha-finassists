import type { ApiTokenCriteria, ApiTokenDeleteCriteria, ApiTokenRepository } from '@modules/tokens/domain';
import { ApiToken } from '@modules/tokens/domain';
import type { Database, SQLQueryBindings } from 'bun:sqlite';

interface TokenRow {
	created_at: string;
	id: string;
	name: string;
	owner_id: string;
	secret_hash: string;
	token_prefix: string;
}

class SqliteApiTokenQueries {
	private constructor() {}

	static where(criteria: ApiTokenCriteria): { parameters: SQLQueryBindings[]; sql: string } {
		const clauses: string[] = [];
		const parameters: SQLQueryBindings[] = [];

		if (criteria.id !== undefined) {
			clauses.push('id = ?');
			parameters.push(criteria.id);
		}
		if (criteria.ownerId !== undefined) {
			clauses.push('owner_id = ?');
			parameters.push(criteria.ownerId);
		}
		if (criteria.secretHash !== undefined) {
			clauses.push('secret_hash = ?');
			parameters.push(criteria.secretHash);
		}

		return { parameters, sql: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '' };
	}
}

export class SqliteApiTokenRepository implements ApiTokenRepository {
	constructor(private readonly database: Database) {}

	async delete({ id, ownerId }: ApiTokenDeleteCriteria): Promise<boolean> {
		const result = this.database.query('DELETE FROM api_tokens WHERE id = ? AND owner_id = ?').run(id, ownerId);
		await Promise.resolve();

		return result.changes > 0;
	}

	async find(criteria: ApiTokenCriteria): Promise<ApiToken | undefined> {
		const tokens = await this.search(criteria);

		return tokens[0];
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

	async search(criteria: ApiTokenCriteria = {}): Promise<ApiToken[]> {
		const filter = SqliteApiTokenQueries.where(criteria);
		const rows = this.database
			.query<TokenRow, SQLQueryBindings[]>(
				`SELECT id, owner_id, name, token_prefix, secret_hash, created_at FROM api_tokens${filter.sql} ORDER BY created_at DESC`
			)
			.all(...filter.parameters);
		const tokens = rows.map(row => this.toApiToken(row));
		await Promise.resolve();

		return tokens;
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
