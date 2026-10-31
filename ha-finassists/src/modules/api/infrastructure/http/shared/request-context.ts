import type { HomeAssistantActor } from '@modules/home-assistant';
import type { FeatureFlags, ShellConfig } from '@modules/shell/domain';
import type {
	AuthenticateSystemCredential,
	ExchangeSystemCredential,
	RevokeSystemCredential,
	RotateSystemCredential,
} from '@modules/system-credentials/application';
import type { AuthenticateApiToken, IssueApiToken, ListApiTokens, RevokeApiToken } from '@modules/tokens/application';

import type { HttpScope } from './http-container';

interface RequestContext {
	developmentActor?: HomeAssistantActor;
	developmentMode?: boolean;
	remoteAddress: string | undefined;
	shellConfig?: ShellConfig;
	trustedIngressIp: string;
}

interface TokenManagementUseCases {
	authenticate: AuthenticateApiToken;
	issue: IssueApiToken;
	list: ListApiTokens;
	revoke: RevokeApiToken;
}

interface SystemCredentialUseCases {
	authenticate: AuthenticateSystemCredential;
	exchange: ExchangeSystemCredential;
	revoke: RevokeSystemCredential;
	rotate: RotateSystemCredential;
}

interface HttpEnvironment {
	Bindings: { requestContext: RequestContext };
	Variables: { di: HttpScope; features: FeatureFlags };
}

export type { HttpEnvironment, RequestContext, SystemCredentialUseCases, TokenManagementUseCases };
