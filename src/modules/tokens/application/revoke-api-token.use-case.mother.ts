import type { RevokeApiTokenParameters } from './revoke-api-token.use-case';

export class RevokeApiTokenParametersMother {
	static create(overrides: Partial<RevokeApiTokenParameters> = {}): RevokeApiTokenParameters {
		return {
			id: 'token-1',
			ownerId: 'user-1',
			...overrides,
		};
	}
}
