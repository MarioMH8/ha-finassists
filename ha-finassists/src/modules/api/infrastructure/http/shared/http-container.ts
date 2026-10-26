import type { InferdiRoot, InferdiScope } from '@inferdi/hono';
import { Container } from '@inferdi/inferdi';
import type { FinanceUseCases } from '@modules/api/infrastructure/http/finance/finance-route-support';

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

interface HttpServiceInstances {
	financeUseCases?: FinanceUseCases;
	systemCredentialUseCases?: SystemCredentialUseCases;
	tokenUseCases: TokenManagementUseCases;
}

class HttpContainerBuilder {
	private constructor() {
		// Static-only helper: instantiation is not part of the contract.
	}

	static create({ financeUseCases, systemCredentialUseCases, tokenUseCases }: HttpServiceInstances): HttpContainer {
		return new Container()
			.registerValue('financeUseCases', financeUseCases)
			.registerValue('systemCredentialUseCases', systemCredentialUseCases)
			.registerValue('tokenUseCases', tokenUseCases);
	}
}

export type { HttpContainer, HttpScope, HttpServices };
export { HttpContainerBuilder };
