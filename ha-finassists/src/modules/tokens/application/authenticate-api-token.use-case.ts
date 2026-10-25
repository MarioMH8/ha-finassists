import type { ApiToken, ApiTokenRepository, TokenCredentialService } from '@modules/tokens/domain';

export class AuthenticateApiToken {
	constructor(
		private readonly apiTokenRepository: ApiTokenRepository,
		private readonly tokenCredentialService: TokenCredentialService
	) {}

	async execute(secret: string): Promise<ApiToken | undefined> {
		const hash = await this.tokenCredentialService.hash(secret);

		return this.apiTokenRepository.find({ secretHash: hash });
	}
}
