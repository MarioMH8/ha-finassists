import type { ApiTokenRepository } from '../domain';

export interface RevokeApiTokenParameters {
	id: string;
	ownerId: string;
}

export class RevokeApiToken {
	constructor(private readonly apiTokenRepository: ApiTokenRepository) {}

	async execute(parameters: RevokeApiTokenParameters): Promise<boolean> {
		return this.apiTokenRepository.delete({ id: parameters.id, ownerId: parameters.ownerId });
	}
}
