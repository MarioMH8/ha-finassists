import type { ApiToken, ApiTokenRepository } from '@modules/tokens/domain';

export class ListApiTokens {
	constructor(private readonly apiTokenRepository: ApiTokenRepository) {}

	async execute(ownerId: string): Promise<ApiToken[]> {
		return this.apiTokenRepository.search({ ownerId });
	}
}
