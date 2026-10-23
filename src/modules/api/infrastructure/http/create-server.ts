import type { HomeAssistantActor } from '@modules/home-assistant';
import type { ShellConfig } from '@modules/shell/domain';

import type { FinanceUseCases, SystemCredentialUseCases, TokenManagementUseCases } from './routes';
import { createHttpApp } from './routes';

export interface ServerOptions {
	developmentActor?: HomeAssistantActor;
	developmentMode?: boolean;
	financeUseCases?: FinanceUseCases;
	port: number;
	shellConfig?: ShellConfig;
	systemCredentialUseCases?: SystemCredentialUseCases;
	tokenUseCases: TokenManagementUseCases;
	trustedIngressIp: string;
}

export function createServer({
	developmentActor,
	developmentMode,
	financeUseCases,
	port,
	shellConfig,
	systemCredentialUseCases,
	tokenUseCases,
	trustedIngressIp,
}: ServerOptions): ReturnType<typeof Bun.serve> {
	const app = createHttpApp(tokenUseCases, financeUseCases, systemCredentialUseCases);
	const server = Bun.serve({
		async fetch(request, server) {
			return app.fetch(request, {
				requestContext: {
					developmentActor,
					developmentMode,
					remoteAddress: server.requestIP(request)?.address,
					shellConfig,
					trustedIngressIp,
				},
			});
		},
		maxRequestBodySize: 6 * 1024 * 1024,
		port,
	});

	return server;
}
