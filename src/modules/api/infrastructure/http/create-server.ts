import type { AppShellSettings } from '@modules/app-configuration/domain';
import type { HomeAssistantActor } from '@modules/home-assistant';

import type { FinanceUseCases, SystemCredentialUseCases, TokenManagementUseCases } from './routes';
import { handleRequest } from './routes';

export interface ServerOptions {
	appShellSettings?: AppShellSettings;
	developmentActor?: HomeAssistantActor;
	developmentMode?: boolean;
	financeUseCases?: FinanceUseCases;
	port: number;
	systemCredentialUseCases?: SystemCredentialUseCases;
	tokenUseCases: TokenManagementUseCases;
	trustedIngressIp: string;
}

export function createServer({
	appShellSettings,
	developmentActor,
	developmentMode,
	financeUseCases,
	port,
	systemCredentialUseCases,
	tokenUseCases,
	trustedIngressIp,
}: ServerOptions): ReturnType<typeof Bun.serve> {
	const server = Bun.serve({
		async fetch(request, server) {
			return handleRequest(
				request,
				{
					appShellSettings,
					developmentActor,
					developmentMode,
					remoteAddress: server.requestIP(request)?.address,
					trustedIngressIp,
				},
				tokenUseCases,
				financeUseCases,
				systemCredentialUseCases
			);
		},
		maxRequestBodySize: 6 * 1024 * 1024,
		port,
	});

	return server;
}
