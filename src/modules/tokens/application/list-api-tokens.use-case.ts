import type { ApiToken, ApiTokenRepository } from '../domain';

export class ListApiTokens {
	constructor(private readonly apiTokenRepository: ApiTokenRepository) {}

	async execute(ownerId: string): Promise<ApiToken[]> {
		return this.apiTokenRepository.findAllByOwner(ownerId);
	}
}
