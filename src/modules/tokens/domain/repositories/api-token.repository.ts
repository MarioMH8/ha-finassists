import type { ApiToken } from '../api-token';

export interface ApiTokenRepository {
	deleteByIdAndOwner(id: string, ownerId: string): Promise<boolean>;
	findAllByOwner(ownerId: string): Promise<ApiToken[]>;
	findByHash(hash: string): Promise<ApiToken | undefined>;
	save(token: ApiToken): Promise<void>;
}
