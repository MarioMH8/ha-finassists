import type { InferdiRoot, InferdiScope } from '@inferdi/hono';
import type { FinanceUseCases } from '@modules/api/infrastructure/http/finance/finance-route-types';

import type { SystemCredentialUseCases, TokenManagementUseCases } from './request-context';

interface HttpServices {
	financeUseCases: FinanceUseCases | undefined;
	systemCredentialUseCases: SystemCredentialUseCases | undefined;
	tokenUseCases: TokenManagementUseCases;
}

interface HttpScope extends InferdiScope {
	get<K extends keyof HttpServices>(key: K): HttpServices[K];
}

type HttpContainer = InferdiRoot<HttpScope>;

export type { HttpContainer, HttpScope, HttpServices };
