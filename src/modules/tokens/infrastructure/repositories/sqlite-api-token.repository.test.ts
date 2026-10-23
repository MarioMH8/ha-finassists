import { migrateDatabase } from '@modules/storage/infrastructure';
import { Database } from 'bun:sqlite';
import { afterEach, describe, expect, it } from 'bun:test';

import { ApiTokenMother } from '../../domain/api-token.mother';
import { SqliteApiTokenRepository } from './sqlite-api-token.repository';

describe('SqliteApiTokenRepository', () => {
	let database: Database;

	afterEach(() => database.close());

	describe('search', () => {
		it('filters by owner and retains newest-first listing order', async () => {
			database = new Database(':memory:');
			migrateDatabase(database);
			const repository = new SqliteApiTokenRepository(database);
			const older = ApiTokenMother.create({
				createdAt: '2026-05-14T00:00:00.000Z',
				id: 'older-token',
				ownerId: 'user-1',
				secretHash: 'older-hash',
			});
			const otherOwner = ApiTokenMother.create({
				id: 'other-owner-token',
				ownerId: 'user-2',
				secretHash: 'other-hash',
			});
			const newer = ApiTokenMother.create({ id: 'newer-token', ownerId: 'user-1', secretHash: 'newer-hash' });

			await repository.save(older);
			await repository.save(otherOwner);
			await repository.save(newer);

			expect(await repository.search({ ownerId: 'user-1' })).toEqual([newer, older]);
		});
	});

	describe('find', () => {
		it('finds a token by its secret hash', async () => {
			database = new Database(':memory:');
			migrateDatabase(database);
			const repository = new SqliteApiTokenRepository(database);
			const token = ApiTokenMother.create({ secretHash: 'sha256-hash' });
			await repository.save(token);

			expect(await repository.find({ secretHash: 'sha256-hash' })).toEqual(token);
			expect(await repository.find({ secretHash: 'missing-hash' })).toBeUndefined();
		});
	});

	describe('delete', () => {
		it('deletes only when both token id and owner match', async () => {
			database = new Database(':memory:');
			migrateDatabase(database);
			const repository = new SqliteApiTokenRepository(database);
			const token = ApiTokenMother.create({ id: 'token-1', ownerId: 'user-1' });
			await repository.save(token);

			expect(await repository.delete({ id: 'token-1', ownerId: 'user-2' })).toBe(false);
			expect(await repository.find({ id: 'token-1' })).toEqual(token);
			expect(await repository.delete({ id: 'token-1', ownerId: 'user-1' })).toBe(true);
			expect(await repository.find({ id: 'token-1' })).toBeUndefined();
		});
	});
});
