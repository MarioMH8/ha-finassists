import { ApiToken } from './api-token';

interface ApiTokenOverrides {
	createdAt: string;
	id: string;
	name: string;
	ownerId: string;
	prefix: string;
	secretHash: string;
}

export class ApiTokenMother {
	static create(overrides: Partial<ApiTokenOverrides> = {}): ApiToken {
		return ApiToken.create({
			createdAt: '2026-05-15T00:00:00.000Z',
			id: 'token-1',
			name: 'Test token',
			ownerId: 'user-1',
			prefix: 'fa_abcdefgh',
			secretHash: 'secret-hash',
			...overrides,
		});
	}
}
