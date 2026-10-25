import type { IssueApiTokenParameters } from './issue-api-token.use-case';

export class IssueApiTokenParametersMother {
	static create(overrides: Partial<IssueApiTokenParameters> = {}): IssueApiTokenParameters {
		return {
			name: 'Home Assistant MCP',
			ownerId: 'user-1',
			...overrides,
		};
	}
}
