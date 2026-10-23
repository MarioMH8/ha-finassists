import { migrateDatabase } from '@modules/storage/infrastructure';
import { Database } from 'bun:sqlite';
import { afterEach, describe, expect, it } from 'bun:test';

import { ApiTokenMother } from '../../domain/api-token.mother';
import { SqliteApiTokenRepository } from './sqlite-api-token.repository';

describe('SqliteApiTokenRepository', () => {
	let database: Database;

	afterEach(() => database.close());

	describe('save', () => {
		it('persists tokens and retrieves them by owner and secret hash', async () => {
			database = new Database(':memory:');
			migrateDatabase(database);
			const repository = new SqliteApiTokenRepository(database);
			const token = ApiTokenMother.create({ id: 'token-1', ownerId: 'user-1', secretHash: 'sha256-hash' });

			await repository.save(token);

			expect(await repository.findAllByOwner('user-1')).toEqual([token]);
			expect(await repository.findByHash('sha256-hash')).toEqual(token);
		});
	});
});
