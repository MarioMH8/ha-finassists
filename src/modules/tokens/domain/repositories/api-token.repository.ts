import type { ApiToken } from '../api-token';

interface ApiTokenCriteria {
	id?: string;
	ownerId?: string;
	secretHash?: string;
}

interface ApiTokenDeleteCriteria {
	id: string;
	ownerId: string;
}

interface ApiTokenRepository {
	delete(criteria: ApiTokenDeleteCriteria): Promise<boolean>;
	find(criteria: ApiTokenCriteria): Promise<ApiToken | undefined>;
	save(token: ApiToken): Promise<void>;
	search(criteria?: ApiTokenCriteria): Promise<ApiToken[]>;
}

export type { ApiTokenCriteria, ApiTokenDeleteCriteria, ApiTokenRepository };
