import { TokenNameRequiredError } from './api-token.error';

interface ApiTokenParameters {
	createdAt: string;
	id: string;
	name: string;
	ownerId: string;
	prefix: string;
	secretHash: string;
}

export class ApiToken {
	private constructor(
		readonly createdAt: string,
		readonly id: string,
		readonly name: string,
		readonly ownerId: string,
		readonly prefix: string,
		readonly secretHash: string
	) {}

	static create(parameters: ApiTokenParameters): ApiToken {
		const name = parameters.name.trim();
		if (!name) {
			throw new TokenNameRequiredError();
		}

		return new ApiToken(
			parameters.createdAt,
			parameters.id,
			name,
			parameters.ownerId,
			parameters.prefix,
			parameters.secretHash
		);
	}
}
