export class TokenNameRequiredError extends Error {
	constructor() {
		super('Token name is required');
		this.name = 'TokenNameRequiredError';
	}
}
