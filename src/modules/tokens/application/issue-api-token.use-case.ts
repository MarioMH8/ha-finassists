import type { ApiTokenRepository, TokenCredentialService } from '@modules/tokens/domain';
import { ApiToken } from '@modules/tokens/domain';

interface IssueApiTokenParameters {
	name: string;
	ownerId: string;
}

interface IssuedApiToken {
	secret: string;
	token: ApiToken;
}

export class IssueApiToken {
	constructor(
		private readonly apiTokenRepository: ApiTokenRepository,
		private readonly tokenCredentialService: TokenCredentialService
	) {}

	async execute(parameters: IssueApiTokenParameters): Promise<IssuedApiToken> {
		const credential = await this.tokenCredentialService.create();
		const token = ApiToken.create({
			createdAt: new Date().toISOString(),
			id: crypto.randomUUID(),
			name: parameters.name,
			ownerId: parameters.ownerId,
			prefix: credential.prefix,
			secretHash: credential.hash,
		});

		await this.apiTokenRepository.save(token);

		return { secret: credential.secret, token };
	}
}

export type { IssueApiTokenParameters };
