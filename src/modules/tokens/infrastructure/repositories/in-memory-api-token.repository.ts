import type { ApiToken, ApiTokenCriteria, ApiTokenDeleteCriteria, ApiTokenRepository } from '../../domain';

export class InMemoryApiTokenRepository implements ApiTokenRepository {
	private readonly tokens = new Map<string, ApiToken>();

	async delete({ id, ownerId }: ApiTokenDeleteCriteria): Promise<boolean> {
		const isOwnedByActor = this.tokens.get(id)?.ownerId === ownerId;
		const isDeleted = isOwnedByActor && this.tokens.delete(id);
		await Promise.resolve();

		return isDeleted;
	}

	async find(criteria: ApiTokenCriteria): Promise<ApiToken | undefined> {
		const tokens = await this.search(criteria);

		return tokens[0];
	}

	async save(token: ApiToken): Promise<void> {
		this.tokens.set(token.id, token);
		await Promise.resolve();
	}

	async search(criteria: ApiTokenCriteria = {}): Promise<ApiToken[]> {
		const tokens = this.tokens
			.values()
			.filter(
				token =>
					(criteria.id === undefined || token.id === criteria.id) &&
					(criteria.ownerId === undefined || token.ownerId === criteria.ownerId) &&
					(criteria.secretHash === undefined || token.secretHash === criteria.secretHash)
			)
			.toArray()
			.toSorted((left, right) => right.createdAt.localeCompare(left.createdAt));
		await Promise.resolve();

		return tokens;
	}
}
