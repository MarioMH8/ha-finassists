import type { HomeAssistantActor } from '@modules/home-assistant';

import type { TokenManagementUseCases } from './routes';
import { handleRequest } from './routes';

export interface ServerOptions {
	developmentActor?: HomeAssistantActor;
	developmentMode?: boolean;
	port: number;
	tokenUseCases: TokenManagementUseCases;
	trustedIngressIp: string;
}

export function createServer({
	developmentActor,
	developmentMode,
	port,
	tokenUseCases,
	trustedIngressIp,
}: ServerOptions): ReturnType<typeof Bun.serve> {
	const server = Bun.serve({
		async fetch(request, server) {
			return handleRequest(
				request,
				{
					developmentActor,
					developmentMode,
					remoteAddress: server.requestIP(request)?.address,
					trustedIngressIp,
				},
				tokenUseCases
			);
		},
		port,
	});

	return server;
}
