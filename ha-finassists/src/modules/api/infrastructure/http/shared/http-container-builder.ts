import { Container } from '@inferdi/inferdi';
import type { FinanceUseCases } from '@modules/api/infrastructure/http/finance/finance-route-types';

import type { HttpContainer } from './http-container';
import type { SystemCredentialUseCases, TokenManagementUseCases } from './request-context';

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

export { HttpContainerBuilder };
