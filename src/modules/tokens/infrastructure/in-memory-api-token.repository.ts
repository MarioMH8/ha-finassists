import type { ApiToken, ApiTokenRepository } from '../domain';

export class InMemoryApiTokenRepository implements ApiTokenRepository {
	private readonly tokens = new Map<string, ApiToken>();

	async deleteByIdAndOwner(id: string, ownerId: string): Promise<boolean> {
		const isOwnedByActor = this.tokens.get(id)?.ownerId === ownerId;

		const isDeleted = isOwnedByActor && this.tokens.delete(id);
		await Promise.resolve();

		return isDeleted;
	}

	async findAllByOwner(ownerId: string): Promise<ApiToken[]> {
		const tokens: ApiToken[] = [];
		for (const token of this.tokens.values()) {
			if (token.ownerId === ownerId) {
				tokens.push(token);
			}
		}

		await Promise.resolve();

		return tokens;
	}

	async findByHash(hash: string): Promise<ApiToken | undefined> {
		let matchingToken: ApiToken | undefined;
		for (const token of this.tokens.values()) {
			if (token.secretHash === hash) {
				matchingToken = token;
				break;
			}
		}
		await Promise.resolve();

		return matchingToken;
	}

	async save(token: ApiToken): Promise<void> {
		this.tokens.set(token.id, token);
		await Promise.resolve();
	}
}
